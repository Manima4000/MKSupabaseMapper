-- Migration 047: Restaurar views e MVWs deletadas pelo CASCADE da migration 046
--
-- Causa raiz: migration 046 executou DROP VIEW vw_student_course_progress CASCADE,
-- o que cascateou e deletou:
--   → vw_subscription_risk_distribution (depende de vw_student_course_progress)
--   → vw_subscription_engagement        (depende de vw_student_course_progress)
--   → mvw_subscription_risk_distribution (depende da view acima)
--   → mvw_subscription_engagement        (depende da view acima)
--
-- Este script restaura todas as quatro, mais a view base.

-- ─── 1. vw_student_course_progress ────────────────────────────────────────────
-- Progresso % por aluno por curso, baseado em lesson_progress (não enrollments).

CREATE OR REPLACE VIEW vw_student_course_progress AS
WITH course_lesson_counts AS (
    SELECT
        s.course_id,
        COUNT(l.id) AS total_lessons
    FROM sections s
    JOIN lessons l ON l.section_id = s.id
    GROUP BY s.course_id
),
student_course_completions AS (
    SELECT
        lp.user_id,
        s.course_id,
        COUNT(DISTINCT lp.lesson_id) AS completed_lessons,
        MAX(lp.completed_at)         AS last_activity_at
    FROM lesson_progress lp
    JOIN lessons l  ON l.id  = lp.lesson_id
    JOIN sections s ON s.id  = l.section_id
    WHERE lp.completed_at IS NOT NULL
    GROUP BY lp.user_id, s.course_id
)
SELECT
    scc.user_id,
    scc.course_id,
    c.name                                                  AS course_name,
    u.full_name                                             AS student_name,
    u.email                                                 AS student_email,
    clc.total_lessons,
    scc.completed_lessons,
    CASE
        WHEN clc.total_lessons = 0 THEN 0
        ELSE ROUND(
            (scc.completed_lessons::NUMERIC / clc.total_lessons) * 100, 1
        )
    END                                                     AS progress_pct,
    scc.last_activity_at
FROM student_course_completions scc
JOIN courses c                ON c.id   = scc.course_id
JOIN users u                  ON u.id   = scc.user_id
JOIN course_lesson_counts clc ON clc.course_id = scc.course_id;


-- ─── 2. vw_subscription_risk_distribution ─────────────────────────────────────
-- % de alunos ativos em cada faixa de risco por plano.

CREATE OR REPLACE VIEW vw_subscription_risk_distribution AS
WITH user_avg_progress AS (
    SELECT user_id, ROUND(AVG(progress_pct), 1) AS avg_progress_pct
    FROM vw_student_course_progress
    GROUP BY user_id
),
user_lesson_velocity AS (
    SELECT
        user_id,
        COUNT(*) FILTER (
            WHERE completed_at >= NOW() - INTERVAL '14 days'
        )                                                   AS last_14d,
        COUNT(*) FILTER (
            WHERE completed_at >= NOW() - INTERVAL '28 days'
              AND completed_at  < NOW() - INTERVAL '14 days'
        )                                                   AS prior_14d
    FROM lesson_progress
    WHERE completed_at IS NOT NULL
    GROUP BY user_id
),
user_risk AS (
    SELECT
        u.id AS user_id,
        ROUND(
            0.40 * CASE
                WHEN u.last_seen_at >= NOW() - INTERVAL '7 days'  THEN 0
                WHEN u.last_seen_at >= NOW() - INTERVAL '14 days' THEN 25
                WHEN u.last_seen_at >= NOW() - INTERVAL '30 days' THEN 50
                WHEN u.last_seen_at >= NOW() - INTERVAL '60 days' THEN 75
                ELSE 100
            END
            + 0.35 * CASE
                WHEN COALESCE(lv.prior_14d, 0) = 0 AND COALESCE(lv.last_14d, 0) = 0 THEN 75
                WHEN COALESCE(lv.prior_14d, 0) = 0                                   THEN 0
                WHEN COALESCE(lv.last_14d, 0)::NUMERIC / lv.prior_14d >= 0.75        THEN 0
                WHEN COALESCE(lv.last_14d, 0)::NUMERIC / lv.prior_14d >= 0.50        THEN 25
                WHEN COALESCE(lv.last_14d, 0)::NUMERIC / lv.prior_14d >= 0.25        THEN 50
                WHEN COALESCE(lv.last_14d, 0) > 0                                    THEN 75
                ELSE 100
            END
            + 0.25 * CASE
                WHEN COALESCE(ap.avg_progress_pct, 0) >= 75 THEN 0
                WHEN COALESCE(ap.avg_progress_pct, 0) >= 50 THEN 25
                WHEN COALESCE(ap.avg_progress_pct, 0) >= 25 THEN 50
                ELSE 75
            END
        )::INTEGER AS risk_score
    FROM users u
    LEFT JOIN user_lesson_velocity lv ON lv.user_id = u.id
    LEFT JOIN user_avg_progress ap    ON ap.user_id  = u.id
),
plan_totals AS (
    SELECT
        ml.id   AS membership_level_id,
        ml.name AS level_name,
        COUNT(DISTINCT m.user_id) AS active_students,
        COUNT(DISTINCT m.user_id) FILTER (WHERE ur.risk_score >= 75)          AS critical_count,
        COUNT(DISTINCT m.user_id) FILTER (
            WHERE ur.risk_score >= 50 AND ur.risk_score < 75
        )                                                                      AS high_count,
        COUNT(DISTINCT m.user_id) FILTER (
            WHERE ur.risk_score >= 25 AND ur.risk_score < 50
        )                                                                      AS medium_count,
        COUNT(DISTINCT m.user_id) FILTER (WHERE ur.risk_score < 25)           AS low_count
    FROM membership_levels ml
    JOIN memberships m ON m.membership_level_id = ml.id AND m.status = 'active'
    LEFT JOIN user_risk ur ON ur.user_id = m.user_id
    GROUP BY ml.id, ml.name
)
SELECT
    membership_level_id,
    level_name,
    active_students,
    critical_count,
    high_count,
    medium_count,
    low_count,
    ROUND(critical_count::NUMERIC / NULLIF(active_students, 0) * 100, 1) AS critical_pct,
    ROUND(high_count::NUMERIC     / NULLIF(active_students, 0) * 100, 1) AS high_pct,
    ROUND(medium_count::NUMERIC   / NULLIF(active_students, 0) * 100, 1) AS medium_pct,
    ROUND(low_count::NUMERIC      / NULLIF(active_students, 0) * 100, 1) AS low_pct
FROM plan_totals
ORDER BY level_name;


-- ─── 3. vw_subscription_engagement ────────────────────────────────────────────
-- Dashboard completo de engajamento por plano (apenas assinantes ativos).

CREATE OR REPLACE VIEW vw_subscription_engagement AS
WITH active_subs AS (
    SELECT m.user_id, m.membership_level_id
    FROM memberships m
    WHERE m.status = 'active'
),
user_lesson_stats AS (
    SELECT
        lp.user_id,
        COUNT(*)                                                       AS total_lessons_completed,
        ROUND(COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2)      AS study_hours
    FROM lesson_progress lp
    LEFT JOIN lesson_videos lv ON lv.lesson_id = lp.lesson_id
    WHERE lp.completed_at IS NOT NULL
    GROUP BY lp.user_id
),
user_avg_progress AS (
    SELECT user_id, ROUND(AVG(progress_pct), 1) AS avg_progress_pct
    FROM vw_student_course_progress
    GROUP BY user_id
),
user_lesson_velocity AS (
    SELECT
        user_id,
        COUNT(*) FILTER (
            WHERE completed_at >= NOW() - INTERVAL '14 days'
        )                                                   AS last_14d,
        COUNT(*) FILTER (
            WHERE completed_at >= NOW() - INTERVAL '28 days'
              AND completed_at  < NOW() - INTERVAL '14 days'
        )                                                   AS prior_14d
    FROM lesson_progress
    WHERE completed_at IS NOT NULL
    GROUP BY user_id
),
user_risk AS (
    SELECT
        u.id AS user_id,
        ROUND(
            0.40 * CASE
                WHEN u.last_seen_at >= NOW() - INTERVAL '7 days'  THEN 0
                WHEN u.last_seen_at >= NOW() - INTERVAL '14 days' THEN 25
                WHEN u.last_seen_at >= NOW() - INTERVAL '30 days' THEN 50
                WHEN u.last_seen_at >= NOW() - INTERVAL '60 days' THEN 75
                ELSE 100
            END
            + 0.35 * CASE
                WHEN COALESCE(lv.prior_14d, 0) = 0 AND COALESCE(lv.last_14d, 0) = 0 THEN 75
                WHEN COALESCE(lv.prior_14d, 0) = 0                                   THEN 0
                WHEN COALESCE(lv.last_14d, 0)::NUMERIC / lv.prior_14d >= 0.75        THEN 0
                WHEN COALESCE(lv.last_14d, 0)::NUMERIC / lv.prior_14d >= 0.50        THEN 25
                WHEN COALESCE(lv.last_14d, 0)::NUMERIC / lv.prior_14d >= 0.25        THEN 50
                WHEN COALESCE(lv.last_14d, 0) > 0                                    THEN 75
                ELSE 100
            END
            + 0.25 * CASE
                WHEN COALESCE(ap.avg_progress_pct, 0) >= 75 THEN 0
                WHEN COALESCE(ap.avg_progress_pct, 0) >= 50 THEN 25
                WHEN COALESCE(ap.avg_progress_pct, 0) >= 25 THEN 50
                ELSE 75
            END
        )::INTEGER AS risk_score
    FROM users u
    LEFT JOIN user_lesson_velocity lv ON lv.user_id = u.id
    LEFT JOIN user_avg_progress ap    ON ap.user_id  = u.id
)
SELECT
    ml.id                                                                    AS membership_level_id,
    ml.name                                                                  AS level_name,
    COUNT(DISTINCT asub.user_id)                                             AS active_students,
    ROUND(AVG(COALESCE(uap.avg_progress_pct, 0)), 1)                        AS avg_progress_pct,
    COALESCE(SUM(uls.total_lessons_completed), 0)                            AS total_lessons_completed,
    ROUND(COALESCE(SUM(uls.study_hours), 0), 2)                              AS total_study_hours,
    ROUND(
        COALESCE(SUM(uls.study_hours), 0)
        / NULLIF(COUNT(DISTINCT asub.user_id), 0), 2
    )                                                                        AS avg_study_hours_per_student,
    COUNT(DISTINCT asub.user_id) FILTER (WHERE ur.risk_score >= 75)          AS students_critical,
    COUNT(DISTINCT asub.user_id) FILTER (
        WHERE ur.risk_score >= 50 AND ur.risk_score < 75
    )                                                                        AS students_high,
    COUNT(DISTINCT asub.user_id) FILTER (
        WHERE ur.risk_score >= 25 AND ur.risk_score < 50
    )                                                                        AS students_medium,
    COUNT(DISTINCT asub.user_id) FILTER (WHERE ur.risk_score < 25)           AS students_low
FROM membership_levels ml
LEFT JOIN active_subs asub      ON asub.membership_level_id = ml.id
LEFT JOIN user_lesson_stats uls ON uls.user_id = asub.user_id
LEFT JOIN user_avg_progress uap ON uap.user_id = asub.user_id
LEFT JOIN user_risk ur          ON ur.user_id  = asub.user_id
GROUP BY ml.id, ml.name
ORDER BY ml.name;


-- ─── 4. mvw_subscription_risk_distribution ────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mvw_subscription_risk_distribution CASCADE;

CREATE MATERIALIZED VIEW mvw_subscription_risk_distribution AS
    SELECT * FROM vw_subscription_risk_distribution;

-- Índice UNIQUE necessário para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX mvw_subscription_risk_distribution_pk
    ON mvw_subscription_risk_distribution (membership_level_id);


-- ─── 5. mvw_subscription_engagement ──────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mvw_subscription_engagement CASCADE;

CREATE MATERIALIZED VIEW mvw_subscription_engagement AS
    SELECT * FROM vw_subscription_engagement;

-- Índice UNIQUE necessário para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX mvw_subscription_engagement_pk
    ON mvw_subscription_engagement (membership_level_id);


-- ─── 6. Atualizar pg_cron ─────────────────────────────────────────────────────
DO $$
BEGIN
    PERFORM cron.unschedule('refresh-dashboard-views');
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh-dashboard-views',
  '0 * * * *',
  $job$
  DO $do$
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_weekly_global_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_yearly_weekly_comparison;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_active_students_flat;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_risk_distribution;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_weekly_trend_normalized;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_engagement;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_expiring_subscriptions;
  END $do$;
  $job$
);
