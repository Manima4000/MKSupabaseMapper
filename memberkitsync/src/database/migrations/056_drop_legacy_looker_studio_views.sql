-- Migration 056: Remove views não-materializadas legadas do Looker Studio
--
-- Contexto:
--   Looker Studio foi descontinuado. O frontend Next.js (dashboard) e o backend
--   memberkitsync consultam exclusivamente as materialized views (mvw_*) e
--   funções RPC — nunca as views regulares abaixo.
--
--   Cada mvw_X foi originalmente criada como `SELECT * FROM vw_X`, o que registra
--   uma dependência real no catálogo do Postgres: `DROP VIEW vw_X` cascateia e
--   derruba `mvw_X` junto (foi o que aconteceu, por acidente, na migration 046).
--
--   Por isso, para cada par, primeiro recriamos a mvw com a query da view
--   "embutida" (sem mais depender da view), preservando os índices existentes,
--   e só então dropamos a view legada.
--
-- Views removidas (não usadas por nenhum código da aplicação; grant SELECT
-- residual da role user_readonly, usada pelo Looker Studio descontinuado):
--   vw_active_students_flat
--   vw_subscription_engagement
--   vw_subscription_risk_distribution
--   vw_subscription_summary
--   vw_subscription_weekly_trend_normalized
--   vw_weekly_global_stats
--   vw_yearly_weekly_comparison
--
-- Views mantidas (sem materialized view irmã e/ou ainda em uso direto):
--   vw_student_course_progress — usada por GET /api/users; base de
--     vw_subscription_engagement/vw_subscription_risk_distribution (que
--     seguem existindo apenas embutidas dentro das mvws acima)
--   vw_membership_courses      — sem mvw irmã, fora do escopo desta migration
--
-- Bug corrigido de passagem:
--   mvw_subscription_weekly_trend_normalized nunca teve índice UNIQUE, então
--   o job pg_cron "refresh-dashboard-views" (hourly) falhava todo run em
--   `REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_weekly_trend_normalized`.
--   Como esse REFRESH está dentro do mesmo bloco DO que os refreshes seguintes,
--   o erro abortava o bloco e mvw_subscription_engagement e
--   mvw_expiring_subscriptions nunca chegavam a ser atualizadas. Adicionamos
--   o índice UNIQUE que faltava em (week_start, membership_level_id).
-- ============================================================================


-- ─── 1. mvw_active_students_flat ─────────────────────────────────────────────

DROP MATERIALIZED VIEW mvw_active_students_flat;

CREATE MATERIALIZED VIEW mvw_active_students_flat AS
SELECT
    lp.user_id,
    u.full_name,
    u.email,
    (date_trunc('week', lp.completed_at))::date AS week_start,
    (count(*))::integer AS lessons_in_week
FROM lesson_progress lp
JOIN users u ON u.id = lp.user_id
WHERE lp.completed_at IS NOT NULL
GROUP BY lp.user_id, u.full_name, u.email, (date_trunc('week', lp.completed_at));

CREATE UNIQUE INDEX mvw_active_students_flat_user_week
    ON mvw_active_students_flat (user_id, week_start);
CREATE INDEX mvw_active_students_flat_week_start
    ON mvw_active_students_flat (week_start);
CREATE INDEX mvw_active_students_flat_user_id
    ON mvw_active_students_flat (user_id);

DROP VIEW vw_active_students_flat;


-- ─── 2. mvw_subscription_engagement ──────────────────────────────────────────

DROP MATERIALIZED VIEW mvw_subscription_engagement;

CREATE MATERIALIZED VIEW mvw_subscription_engagement AS
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

CREATE UNIQUE INDEX mvw_subscription_engagement_pk
    ON mvw_subscription_engagement (membership_level_id);

DROP VIEW vw_subscription_engagement;


-- ─── 3. mvw_subscription_risk_distribution ───────────────────────────────────

DROP MATERIALIZED VIEW mvw_subscription_risk_distribution;

CREATE MATERIALIZED VIEW mvw_subscription_risk_distribution AS
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

CREATE UNIQUE INDEX mvw_subscription_risk_distribution_pk
    ON mvw_subscription_risk_distribution (membership_level_id);

DROP VIEW vw_subscription_risk_distribution;


-- ─── 4. mvw_subscription_summary ─────────────────────────────────────────────

DROP MATERIALIZED VIEW mvw_subscription_summary;

CREATE MATERIALIZED VIEW mvw_subscription_summary AS
SELECT
    ml.id AS membership_level_id,
    ml.name AS level_name,
    COUNT(m.id) FILTER (WHERE m.status = 'active')   AS active_count,
    COUNT(m.id) FILTER (WHERE m.status = 'pending')  AS pending_count,
    COUNT(m.id) FILTER (WHERE m.status = 'expired')  AS expired_count,
    COUNT(m.id) FILTER (WHERE m.status = 'inactive') AS inactive_count,
    COUNT(m.id) AS total_count,
    COUNT(DISTINCT m.user_id) FILTER (
        WHERE m.status = 'active' AND EXISTS (
            SELECT 1 FROM lesson_progress lp
            WHERE lp.user_id = m.user_id AND lp.completed_at IS NOT NULL
        )
    ) AS engaged_active_count
FROM membership_levels ml
LEFT JOIN memberships m ON m.membership_level_id = ml.id
GROUP BY ml.id, ml.name
ORDER BY ml.name;

CREATE UNIQUE INDEX mvw_subscription_summary_level_id
    ON mvw_subscription_summary (membership_level_id);

DROP VIEW vw_subscription_summary;


-- ─── 5. mvw_subscription_weekly_trend_normalized ─────────────────────────────

DROP MATERIALIZED VIEW mvw_subscription_weekly_trend_normalized;

CREATE MATERIALIZED VIEW mvw_subscription_weekly_trend_normalized AS
SELECT
    (date_trunc('week', lp.completed_at))::date AS week_start,
    ml.id   AS membership_level_id,
    ml.name AS level_name,
    COUNT(DISTINCT lp.user_id) AS active_students,
    COUNT(*) AS lessons_completed,
    ROUND(COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2) AS estimated_hours,
    ROUND(COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT lp.user_id), 0), 1) AS lessons_per_student,
    ROUND(
        (COALESCE(SUM(lv.duration_seconds), 0) / 3600.0)
        / NULLIF(COUNT(DISTINCT lp.user_id), 0), 2
    ) AS hours_per_student
FROM lesson_progress lp
LEFT JOIN lesson_videos lv ON lv.lesson_id = lp.lesson_id
JOIN memberships m         ON m.user_id = lp.user_id AND m.status = 'active'
JOIN membership_levels ml  ON ml.id = m.membership_level_id
WHERE lp.completed_at IS NOT NULL
GROUP BY (date_trunc('week', lp.completed_at)), ml.id, ml.name
ORDER BY (date_trunc('week', lp.completed_at))::date DESC, ml.name;

CREATE INDEX idx_mvw_sub_trend_week
    ON mvw_subscription_weekly_trend_normalized (week_start);

-- Índice UNIQUE que faltava — necessário para REFRESH CONCURRENTLY (ver nota no topo)
CREATE UNIQUE INDEX mvw_subscription_weekly_trend_normalized_pk
    ON mvw_subscription_weekly_trend_normalized (week_start, membership_level_id);

DROP VIEW vw_subscription_weekly_trend_normalized;


-- ─── 6. mvw_weekly_global_stats ───────────────────────────────────────────────

DROP MATERIALIZED VIEW mvw_weekly_global_stats;

CREATE MATERIALIZED VIEW mvw_weekly_global_stats AS
WITH student_weekly AS (
    SELECT
        (date_trunc('week', completed_at))::date AS week_start,
        user_id,
        COUNT(*) AS lessons_completed
    FROM lesson_progress
    WHERE completed_at IS NOT NULL
    GROUP BY (date_trunc('week', completed_at)), user_id
)
SELECT
    week_start,
    SUM(lessons_completed)::BIGINT AS total_lessons_completed,
    COUNT(DISTINCT user_id) AS active_students,
    ROUND(AVG(lessons_completed), 2) AS avg_lessons_per_active_student,
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lessons_completed::DOUBLE PRECISION))::NUMERIC AS median_lessons_per_active_student
FROM student_weekly
GROUP BY week_start
ORDER BY week_start;

CREATE UNIQUE INDEX mvw_weekly_global_stats_week_start
    ON mvw_weekly_global_stats (week_start);
CREATE INDEX mvw_weekly_global_stats_week_start_brin
    ON mvw_weekly_global_stats USING brin (week_start);

DROP VIEW vw_weekly_global_stats;


-- ─── 7. mvw_yearly_weekly_comparison ─────────────────────────────────────────

DROP MATERIALIZED VIEW mvw_yearly_weekly_comparison;

CREATE MATERIALIZED VIEW mvw_yearly_weekly_comparison AS
WITH per_student AS (
    SELECT
        EXTRACT(isoyear FROM completed_at)::INTEGER AS year,
        EXTRACT(week FROM completed_at)::INTEGER     AS iso_week,
        user_id,
        COUNT(*) AS student_lessons
    FROM lesson_progress
    WHERE completed_at IS NOT NULL
      AND EXTRACT(isoyear FROM completed_at) >= 2024
    GROUP BY EXTRACT(isoyear FROM completed_at)::INTEGER, EXTRACT(week FROM completed_at)::INTEGER, user_id
)
SELECT
    year,
    iso_week,
    TO_DATE(year::TEXT || LPAD(iso_week::TEXT, 2, '0'), 'IYYYIW') AS week_start,
    SUM(student_lessons)::BIGINT AS lessons_completed,
    COUNT(DISTINCT user_id) AS active_students,
    ROUND(AVG(student_lessons), 2) AS avg_lessons_per_student,
    ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY student_lessons::DOUBLE PRECISION))::NUMERIC, 2) AS median_lessons_per_student
FROM per_student
GROUP BY year, iso_week
ORDER BY year, iso_week;

CREATE UNIQUE INDEX mvw_yearly_weekly_comparison_year_week
    ON mvw_yearly_weekly_comparison (year, iso_week);

DROP VIEW vw_yearly_weekly_comparison;
