-- ============================================================================
-- Migration 031: Views for Power BI — Year Comparison + Normalized Subscription
--
-- Context:
--   1. vw_yearly_weekly_comparison: compares same ISO week across years (2025 vs 2026)
--      Used in the "Visao Geral" footer chart to show week-over-week year comparison.
--
--   2. vw_subscription_weekly_trend_normalized: same as vw_subscription_weekly_trend
--      but adds per-student metrics (lessons_per_student, hours_per_student).
--      Solves the problem of plans with very different student counts being
--      incomparable when shown as absolute numbers.
--
--   3. vw_subscription_risk_distribution: risk level percentages per plan.
--      Shows what % of each plan's active students are critical/high/medium/low risk.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. vw_yearly_weekly_comparison
-- One row per (year, iso_week): lessons completed, active students, hours.
-- Only includes 2025+ data for the year-over-year Power BI chart.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_yearly_weekly_comparison AS
SELECT
    EXTRACT(ISOYEAR FROM lp.completed_at)::INTEGER          AS year,
    EXTRACT(WEEK FROM lp.completed_at)::INTEGER             AS iso_week,
    MIN(DATE_TRUNC('week', lp.completed_at)::DATE)          AS week_start,
    COUNT(*)                                                 AS lessons_completed,
    COUNT(DISTINCT lp.user_id)                               AS active_students,
    ROUND(
        COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2
    )                                                        AS estimated_hours
FROM lesson_progress lp
LEFT JOIN lesson_videos lv ON lv.lesson_id = lp.lesson_id
WHERE lp.completed_at IS NOT NULL
  AND EXTRACT(ISOYEAR FROM lp.completed_at) >= 2025
GROUP BY
    EXTRACT(ISOYEAR FROM lp.completed_at),
    EXTRACT(WEEK FROM lp.completed_at)
ORDER BY year, iso_week;


-- ----------------------------------------------------------------------------
-- 2. vw_subscription_weekly_trend_normalized
-- Weekly trend per plan with per-student normalized metrics.
-- lessons_per_student = lessons_completed / active_students
-- hours_per_student   = estimated_hours   / active_students
-- ----------------------------------------------------------------------------

CREATE VIEW vw_subscription_weekly_trend_normalized AS
SELECT
    DATE_TRUNC('week', lp.completed_at)::DATE               AS week_start,
    ml.name                                                  AS subscription_name,
    COUNT(DISTINCT lp.user_id)                               AS active_students,
    COUNT(*)                                                 AS lessons_completed,
    ROUND(
        COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2
    )                                                        AS estimated_hours,
    -- Normalized per-student metrics
    ROUND(
        COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT lp.user_id), 0), 1
    )                                                        AS lessons_per_student,
    ROUND(
        (COALESCE(SUM(lv.duration_seconds), 0) / 3600.0)
        / NULLIF(COUNT(DISTINCT lp.user_id), 0), 2
    )                                                        AS hours_per_student
FROM lesson_progress lp
LEFT JOIN lesson_videos lv    ON lv.lesson_id = lp.lesson_id
JOIN memberships m            ON m.user_id    = lp.user_id AND m.status = 'active'
JOIN membership_levels ml     ON ml.id        = m.membership_level_id
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.completed_at), ml.id, ml.name
ORDER BY week_start DESC, subscription_name;


-- ----------------------------------------------------------------------------
-- 3. vw_subscription_risk_distribution
-- Percentage of active students in each risk bracket per plan.
-- Uses the same risk score formula as vw_subscription_engagement.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_subscription_risk_distribution AS
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
    LEFT JOIN user_avg_progress ap    ON ap.user_id = u.id
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
    -- Percentages for easy Power BI charting
    ROUND(critical_count::NUMERIC / NULLIF(active_students, 0) * 100, 1)  AS critical_pct,
    ROUND(high_count::NUMERIC     / NULLIF(active_students, 0) * 100, 1)  AS high_pct,
    ROUND(medium_count::NUMERIC   / NULLIF(active_students, 0) * 100, 1)  AS medium_pct,
    ROUND(low_count::NUMERIC      / NULLIF(active_students, 0) * 100, 1)  AS low_pct
FROM plan_totals
ORDER BY level_name;
