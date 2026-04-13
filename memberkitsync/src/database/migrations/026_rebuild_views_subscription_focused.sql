-- ============================================================================
-- Migration 026: Rebuild All Views — Subscription-Focused (No Enrollments)
--
-- Context:
--   Migration 025 used enrollments as the base for student counts and progress.
--   In practice, enrollments data is mostly empty/zeroed because student access
--   is granted via subscriptions (membership_levels → memberships), not
--   course-level enrollments. This migration drops all views/functions from 025
--   and recreates them using lesson_progress as the source of truth for student
--   activity, and memberships for subscription status.
--
--   NO view references the enrollments table for student counts or progress.
--   NO view references user_activities (legacy) or quiz_attempts.
--
-- Groups:
--   1. DROP all views/functions from migration 025
--   2. Base views + functions
--   3. Weekly global metrics
--   4. Individual pedagogical tracking
--   5. Subscription-level overview
--   6. Content analytics
-- ============================================================================


-- ============================================================================
-- 1. DROP all views and functions from migration 025
-- ============================================================================

DROP VIEW IF EXISTS vw_lesson_ratings_summary CASCADE;
DROP VIEW IF EXISTS vw_course_funnel CASCADE;
DROP VIEW IF EXISTS vw_lesson_stats_enhanced CASCADE;
DROP VIEW IF EXISTS vw_lesson_stats CASCADE;
DROP VIEW IF EXISTS vw_subscription_course_completion CASCADE;
DROP VIEW IF EXISTS vw_subscription_weekly_trend CASCADE;
DROP VIEW IF EXISTS vw_subscription_engagement CASCADE;
DROP VIEW IF EXISTS vw_subscription_summary CASCADE;
DROP VIEW IF EXISTS vw_at_risk_students CASCADE;
DROP VIEW IF EXISTS vw_learning_velocity CASCADE;
DROP VIEW IF EXISTS vw_student_weekly_activity CASCADE;
DROP VIEW IF EXISTS vw_student_overview CASCADE;
DROP VIEW IF EXISTS vw_inactive_students CASCADE;
DROP VIEW IF EXISTS vw_weekly_study_hours_by_subscription CASCADE;
DROP VIEW IF EXISTS vw_weekly_study_hours CASCADE;
DROP VIEW IF EXISTS vw_weekly_active_students_by_subscription CASCADE;
DROP VIEW IF EXISTS vw_weekly_active_students CASCADE;
DROP VIEW IF EXISTS vw_weekly_lessons_completed CASCADE;
DROP VIEW IF EXISTS vw_student_section_progress CASCADE;
DROP VIEW IF EXISTS vw_student_course_progress CASCADE;
DROP VIEW IF EXISTS vw_lesson_progress CASCADE;

DROP FUNCTION IF EXISTS fn_student_full_progress(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS fn_resolve_mk_id(TEXT, INTEGER) CASCADE;


-- ============================================================================
-- 2. Base views + functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_lesson_progress
-- Thin abstraction over the physical lesson_progress table.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_lesson_progress AS
SELECT
    user_id,
    lesson_id,
    completed_at,
    occurred_at
FROM lesson_progress;


-- ----------------------------------------------------------------------------
-- vw_student_course_progress
-- Completion % per student per course. Based on lesson_progress, NOT enrollments.
-- Only shows courses where the student has completed at least 1 lesson.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_student_course_progress AS
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
JOIN courses c              ON c.id  = scc.course_id
JOIN users u                ON u.id  = scc.user_id
JOIN course_lesson_counts clc ON clc.course_id = scc.course_id;


-- ----------------------------------------------------------------------------
-- vw_student_section_progress
-- Completion % per student per section. Based on lesson_progress, NOT enrollments.
-- Only shows sections where the student has completed at least 1 lesson.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_student_section_progress AS
WITH section_lesson_counts AS (
    SELECT
        l.section_id,
        COUNT(l.id) AS total_lessons
    FROM lessons l
    GROUP BY l.section_id
),
student_section_completions AS (
    SELECT
        lp.user_id,
        l.section_id,
        COUNT(DISTINCT lp.lesson_id) AS completed_lessons,
        MAX(lp.completed_at)         AS last_activity_at
    FROM lesson_progress lp
    JOIN lessons l ON l.id = lp.lesson_id
    WHERE lp.completed_at IS NOT NULL
    GROUP BY lp.user_id, l.section_id
)
SELECT
    ssc.user_id,
    u.full_name                                             AS student_name,
    ssc.section_id,
    s.name                                                  AS section_name,
    s.position                                              AS section_position,
    s.course_id,
    c.name                                                  AS course_name,
    slc.total_lessons,
    ssc.completed_lessons,
    CASE
        WHEN slc.total_lessons = 0 THEN 0
        ELSE ROUND(
            (ssc.completed_lessons::NUMERIC / slc.total_lessons) * 100, 1
        )
    END                                                     AS progress_pct,
    (ssc.completed_lessons >= slc.total_lessons)            AS section_completed,
    ssc.last_activity_at
FROM student_section_completions ssc
JOIN sections s                 ON s.id  = ssc.section_id
JOIN courses c                  ON c.id  = s.course_id
JOIN users u                    ON u.id  = ssc.user_id
JOIN section_lesson_counts slc  ON slc.section_id = ssc.section_id;


-- ----------------------------------------------------------------------------
-- fn_student_full_progress(user_id)
-- Returns fully nested JSON: courses → sections → lessons with completion.
-- Based on courses where the user has completed at least 1 lesson.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_student_full_progress(p_user_id BIGINT)
RETURNS JSONB AS $$
SELECT COALESCE(
    JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'course_id',    c.id,
            'course_name',  c.name,
            'sections', (
                SELECT COALESCE(JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'section_id',   sec.id,
                        'section_name', sec.name,
                        'position',     sec.position,
                        'lessons', (
                            SELECT COALESCE(JSONB_AGG(
                                JSONB_BUILD_OBJECT(
                                    'lesson_id',    les.id,
                                    'title',        les.title,
                                    'position',     les.position,
                                    'completed',    (lp.lesson_id IS NOT NULL),
                                    'completed_at', lp.completed_at
                                ) ORDER BY les.position
                            ), '[]'::JSONB)
                            FROM lessons les
                            LEFT JOIN lesson_progress lp
                                ON lp.lesson_id = les.id
                               AND lp.user_id   = p_user_id
                               AND lp.completed_at IS NOT NULL
                            WHERE les.section_id = sec.id
                        )
                    ) ORDER BY sec.position
                ), '[]'::JSONB)
                FROM sections sec
                WHERE sec.course_id = c.id
            )
        )
    ),
    '[]'::JSONB
)
FROM (
    SELECT DISTINCT s.course_id
    FROM lesson_progress lp
    JOIN lessons l  ON l.id  = lp.lesson_id
    JOIN sections s ON s.id  = l.section_id
    WHERE lp.user_id = p_user_id
      AND lp.completed_at IS NOT NULL
) AS active_courses
JOIN courses c ON c.id = active_courses.course_id;
$$ LANGUAGE sql STABLE;


-- ----------------------------------------------------------------------------
-- fn_resolve_mk_id(table_name, mk_id)
-- Translates a MemberKit ID to the internal BIGINT id.
-- Used by the webhook handler.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_resolve_mk_id(
    p_table_name TEXT,
    p_mk_id      INTEGER
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    EXECUTE format('SELECT id FROM %I WHERE mk_id = $1', p_table_name)
        INTO v_id
        USING p_mk_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- 3. Weekly global metrics
-- All views use lesson_progress (NOT user_activities, NOT enrollments).
-- "Active" = completed at least 1 lesson in that week.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_weekly_lessons_completed
-- Total lesson completions per ISO week (Mon-Sun).
-- ----------------------------------------------------------------------------

CREATE VIEW vw_weekly_lessons_completed AS
SELECT
    DATE_TRUNC('week', lp.completed_at)::DATE       AS week_start,
    COUNT(*)                                         AS completed_lessons
FROM lesson_progress lp
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.completed_at)
ORDER BY week_start DESC;


-- ----------------------------------------------------------------------------
-- vw_weekly_active_students
-- Unique students who completed at least 1 lesson per week.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_weekly_active_students AS
SELECT
    DATE_TRUNC('week', lp.completed_at)::DATE       AS week_start,
    COUNT(DISTINCT lp.user_id)                       AS active_students
FROM lesson_progress lp
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.completed_at)
ORDER BY week_start DESC;


-- ----------------------------------------------------------------------------
-- vw_weekly_active_students_by_subscription
-- Same as above but broken down by subscription plan.
-- Uses the student's CURRENT active subscriptions (not historical).
-- ----------------------------------------------------------------------------

CREATE VIEW vw_weekly_active_students_by_subscription AS
SELECT
    DATE_TRUNC('week', lp.completed_at)::DATE       AS week_start,
    ml.name                                          AS subscription_name,
    COUNT(DISTINCT lp.user_id)                       AS active_students
FROM lesson_progress lp
JOIN memberships m        ON m.user_id = lp.user_id AND m.status = 'active'
JOIN membership_levels ml ON ml.id    = m.membership_level_id
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.completed_at), ml.id, ml.name
ORDER BY week_start DESC, subscription_name;


-- ----------------------------------------------------------------------------
-- vw_weekly_study_hours
-- Estimated study hours per week, derived from lesson video durations.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_weekly_study_hours AS
SELECT
    DATE_TRUNC('week', lp.completed_at)::DATE           AS week_start,
    COUNT(DISTINCT lp.user_id)                           AS active_students,
    ROUND(
        COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2
    )                                                    AS total_study_hours,
    ROUND(
        COALESCE(SUM(lv.duration_seconds), 0)::NUMERIC
        / NULLIF(COUNT(DISTINCT lp.user_id), 0) / 3600.0, 2
    )                                                    AS avg_hours_per_student
FROM lesson_progress lp
LEFT JOIN lesson_videos lv ON lv.lesson_id = lp.lesson_id
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.completed_at)
ORDER BY week_start DESC;


-- ----------------------------------------------------------------------------
-- vw_weekly_study_hours_by_subscription
-- Same as vw_weekly_study_hours but broken down by subscription plan.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_weekly_study_hours_by_subscription AS
SELECT
    DATE_TRUNC('week', lp.completed_at)::DATE           AS week_start,
    ml.name                                              AS subscription_name,
    COUNT(DISTINCT lp.user_id)                           AS active_students,
    ROUND(
        COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2
    )                                                    AS total_study_hours,
    ROUND(
        COALESCE(SUM(lv.duration_seconds), 0)::NUMERIC
        / NULLIF(COUNT(DISTINCT lp.user_id), 0) / 3600.0, 2
    )                                                    AS avg_hours_per_student
FROM lesson_progress lp
LEFT JOIN lesson_videos lv    ON lv.lesson_id = lp.lesson_id
JOIN memberships m            ON m.user_id    = lp.user_id AND m.status = 'active'
JOIN membership_levels ml     ON ml.id        = m.membership_level_id
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.completed_at), ml.id, ml.name
ORDER BY week_start DESC, subscription_name;


-- ============================================================================
-- 4. Individual pedagogical tracking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_inactive_students
-- Students with an active subscription who haven't logged in for 7+ days.
-- Includes total lessons completed and date of last lesson for context.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_inactive_students AS
SELECT
    u.id                                                             AS user_id,
    u.full_name,
    u.email,
    u.last_seen_at,
    u.sign_in_count,
    EXTRACT(DAY FROM NOW() - u.last_seen_at)::INTEGER                AS days_inactive,
    ARRAY_AGG(DISTINCT ml.name) FILTER (WHERE m.status = 'active')   AS active_subscriptions,
    COUNT(DISTINCT lp.lesson_id)                                     AS total_lessons_completed,
    MAX(lp.completed_at)                                             AS last_lesson_completed_at
FROM users u
LEFT JOIN memberships m         ON m.user_id        = u.id
LEFT JOIN membership_levels ml  ON ml.id            = m.membership_level_id
LEFT JOIN lesson_progress lp    ON lp.user_id       = u.id
                                AND lp.completed_at IS NOT NULL
WHERE u.last_seen_at < NOW() - INTERVAL '7 days'
  AND u.blocked = FALSE
  AND EXISTS (
      SELECT 1 FROM memberships m2
      WHERE m2.user_id = u.id AND m2.status = 'active'
  )
GROUP BY u.id, u.full_name, u.email, u.last_seen_at, u.sign_in_count
ORDER BY u.last_seen_at ASC;


-- ----------------------------------------------------------------------------
-- vw_student_overview
-- One row per student with all key indicators.
-- Uses CTEs to compute each metric group independently, avoiding JOIN fan-out.
--
-- Changes from 025:
--   REMOVED: enrolled_courses (from enrollments table)
--   ADDED:   courses_with_activity (distinct courses with >=1 completed lesson)
--   ADDED:   sections_completed (sections where ALL lessons are completed)
-- ----------------------------------------------------------------------------

CREATE VIEW vw_student_overview AS
WITH lesson_stats AS (
    SELECT
        lp.user_id,
        COUNT(*)                                                       AS total_lessons_completed,
        MAX(lp.completed_at)                                           AS last_lesson_completed_at,
        ROUND(COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2)      AS estimated_study_hours
    FROM lesson_progress lp
    LEFT JOIN lesson_videos lv ON lv.lesson_id = lp.lesson_id
    WHERE lp.completed_at IS NOT NULL
    GROUP BY lp.user_id
),
section_completions AS (
    SELECT
        lp.user_id,
        l.section_id,
        COUNT(DISTINCT lp.lesson_id)                                   AS completed,
        (SELECT COUNT(*) FROM lessons l2 WHERE l2.section_id = l.section_id) AS total
    FROM lesson_progress lp
    JOIN lessons l ON l.id = lp.lesson_id
    WHERE lp.completed_at IS NOT NULL
    GROUP BY lp.user_id, l.section_id
),
progress_summary AS (
    SELECT
        sc.user_id,
        COUNT(DISTINCT sc.section_id) FILTER (WHERE sc.completed >= sc.total)
                                                                       AS sections_completed,
        COUNT(DISTINCT s.course_id)                                    AS courses_with_activity
    FROM section_completions sc
    JOIN sections s ON s.id = sc.section_id
    GROUP BY sc.user_id
),
rating_stats AS (
    SELECT
        user_id,
        COUNT(DISTINCT lesson_id)   AS total_lessons_rated,
        ROUND(AVG(stars), 1)        AS avg_rating_given
    FROM lesson_ratings
    GROUP BY user_id
),
comment_stats AS (
    SELECT user_id, COUNT(*) AS total_comments
    FROM comments
    GROUP BY user_id
),
forum_post_stats AS (
    SELECT user_id, COUNT(*) AS total_forum_posts, MAX(occurred_at) AS last_post_at
    FROM forum_posts
    GROUP BY user_id
),
forum_comment_stats AS (
    SELECT user_id, COUNT(*) AS total_forum_comments, MAX(occurred_at) AS last_comment_at
    FROM forum_comments
    GROUP BY user_id
),
download_stats AS (
    SELECT user_id, COUNT(*) AS total_file_downloads, MAX(occurred_at) AS last_download_at
    FROM lesson_file_downloads
    GROUP BY user_id
),
subscription_stats AS (
    SELECT
        m.user_id,
        COUNT(*) FILTER (WHERE m.status = 'active')                    AS active_subscriptions,
        ARRAY_AGG(DISTINCT ml.name) FILTER (WHERE m.status = 'active') AS active_subscription_names
    FROM memberships m
    JOIN membership_levels ml ON ml.id = m.membership_level_id
    GROUP BY m.user_id
)
SELECT
    u.id                                                                    AS user_id,
    u.mk_id,
    u.full_name,
    u.email,
    u.blocked,
    u.sign_in_count,
    u.last_seen_at,
    EXTRACT(DAY FROM NOW() - u.last_seen_at)::INTEGER                       AS days_since_last_seen,

    COALESCE(ss.active_subscriptions, 0)                                    AS active_subscriptions,
    ss.active_subscription_names,

    COALESCE(ps.courses_with_activity, 0)                                   AS courses_with_activity,
    COALESCE(ps.sections_completed, 0)                                      AS sections_completed,

    COALESCE(ls.total_lessons_completed, 0)                                 AS total_lessons_completed,
    ls.last_lesson_completed_at,
    EXTRACT(DAY FROM NOW() - ls.last_lesson_completed_at)::INTEGER          AS days_since_last_lesson,
    COALESCE(ls.estimated_study_hours, 0)                                   AS estimated_study_hours,

    COALESCE(rs.total_lessons_rated, 0)                                     AS total_lessons_rated,
    rs.avg_rating_given,

    COALESCE(cs.total_comments, 0)                                          AS total_comments,

    COALESCE(fps.total_forum_posts, 0)                                      AS total_forum_posts,
    COALESCE(fcs.total_forum_comments, 0)                                   AS total_forum_comments,
    GREATEST(fps.last_post_at, fcs.last_comment_at)                         AS last_forum_activity_at,

    COALESCE(ds.total_file_downloads, 0)                                    AS total_file_downloads,
    ds.last_download_at

FROM users u
LEFT JOIN subscription_stats ss      ON ss.user_id  = u.id
LEFT JOIN progress_summary ps        ON ps.user_id  = u.id
LEFT JOIN lesson_stats ls            ON ls.user_id  = u.id
LEFT JOIN rating_stats rs            ON rs.user_id  = u.id
LEFT JOIN comment_stats cs           ON cs.user_id  = u.id
LEFT JOIN forum_post_stats fps       ON fps.user_id = u.id
LEFT JOIN forum_comment_stats fcs    ON fcs.user_id = u.id
LEFT JOIN download_stats ds          ON ds.user_id  = u.id;


-- ----------------------------------------------------------------------------
-- vw_student_weekly_activity
-- All activity types aggregated per student per week.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_student_weekly_activity AS
WITH lesson_weeks AS (
    SELECT
        lp.user_id,
        DATE_TRUNC('week', lp.completed_at)::DATE      AS week_start,
        COUNT(*)                                        AS lessons_completed,
        ROUND(
            COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2
        )                                              AS estimated_hours
    FROM lesson_progress lp
    LEFT JOIN lesson_videos lv ON lv.lesson_id = lp.lesson_id
    WHERE lp.completed_at IS NOT NULL
    GROUP BY lp.user_id, DATE_TRUNC('week', lp.completed_at)
),
forum_post_weeks AS (
    SELECT user_id, DATE_TRUNC('week', occurred_at)::DATE AS week_start, COUNT(*) AS cnt
    FROM forum_posts
    GROUP BY user_id, DATE_TRUNC('week', occurred_at)
),
forum_comment_weeks AS (
    SELECT user_id, DATE_TRUNC('week', occurred_at)::DATE AS week_start, COUNT(*) AS cnt
    FROM forum_comments
    GROUP BY user_id, DATE_TRUNC('week', occurred_at)
),
download_weeks AS (
    SELECT user_id, DATE_TRUNC('week', occurred_at)::DATE AS week_start, COUNT(*) AS cnt
    FROM lesson_file_downloads
    GROUP BY user_id, DATE_TRUNC('week', occurred_at)
),
all_weeks AS (
    SELECT user_id, week_start FROM lesson_weeks
    UNION
    SELECT user_id, week_start FROM forum_post_weeks
    UNION
    SELECT user_id, week_start FROM forum_comment_weeks
    UNION
    SELECT user_id, week_start FROM download_weeks
)
SELECT
    aw.user_id,
    u.full_name,
    aw.week_start,
    COALESCE(lw.lessons_completed, 0)                   AS lessons_completed,
    COALESCE(lw.estimated_hours, 0)                     AS estimated_hours,
    COALESCE(fpw.cnt, 0)                                AS forum_posts,
    COALESCE(fcw.cnt, 0)                                AS forum_comments,
    COALESCE(dw.cnt, 0)                                 AS file_downloads,
    -- Weighted engagement score
    (COALESCE(lw.lessons_completed, 0) * 3
     + COALESCE(fpw.cnt, 0)
     + COALESCE(fcw.cnt, 0)
     + COALESCE(dw.cnt, 0))                             AS engagement_points
FROM all_weeks aw
JOIN users u ON u.id = aw.user_id
LEFT JOIN lesson_weeks lw
    ON lw.user_id = aw.user_id AND lw.week_start = aw.week_start
LEFT JOIN forum_post_weeks fpw
    ON fpw.user_id = aw.user_id AND fpw.week_start = aw.week_start
LEFT JOIN forum_comment_weeks fcw
    ON fcw.user_id = aw.user_id AND fcw.week_start = aw.week_start
LEFT JOIN download_weeks dw
    ON dw.user_id = aw.user_id AND dw.week_start = aw.week_start
ORDER BY aw.user_id, aw.week_start DESC;


-- ----------------------------------------------------------------------------
-- vw_learning_velocity
-- Weekly lesson completion count per student + cumulative + week-over-week change.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_learning_velocity AS
WITH weekly AS (
    SELECT
        lp.user_id,
        DATE_TRUNC('week', lp.completed_at)::DATE       AS week_start,
        COUNT(*)                                         AS lessons_completed,
        ROUND(
            COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2
        )                                                AS estimated_hours
    FROM lesson_progress lp
    LEFT JOIN lesson_videos lv ON lv.lesson_id = lp.lesson_id
    WHERE lp.completed_at IS NOT NULL
    GROUP BY lp.user_id, DATE_TRUNC('week', lp.completed_at)
)
SELECT
    w.user_id,
    u.full_name,
    w.week_start,
    w.lessons_completed,
    SUM(w.lessons_completed) OVER (
        PARTITION BY w.user_id
        ORDER BY w.week_start
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                                    AS cumulative_lessons,
    w.estimated_hours,
    w.lessons_completed - COALESCE(
        LAG(w.lessons_completed) OVER (
            PARTITION BY w.user_id ORDER BY w.week_start
        ), 0
    )                                                    AS week_over_week_change
FROM weekly w
JOIN users u ON u.id = w.user_id
ORDER BY w.user_id, w.week_start DESC;


-- ----------------------------------------------------------------------------
-- vw_at_risk_students
-- Composite risk score (0-100) for all students with active subscriptions.
-- Higher score = higher risk of disengagement.
--
-- Score components (each 0/25/50/75/100):
--   40%  inactivity  - days since last login
--   35%  velocity    - lesson completion rate: last 14d vs prior 14d
--   25%  progress    - average course completion %
--
-- Risk levels:  critical >= 75 | high >= 50 | medium >= 25 | low < 25
--
-- Changes from 025:
--   REMOVED: enrolled_courses (from enrollments table)
--   Uses vw_student_course_progress which is now lesson_progress-based.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_at_risk_students AS
WITH active_students AS (
    SELECT DISTINCT u.id AS user_id
    FROM users u
    JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
    WHERE u.blocked = FALSE
),
subscriptions AS (
    SELECT
        m.user_id,
        ARRAY_AGG(DISTINCT ml.name) AS active_subscription_names
    FROM memberships m
    JOIN membership_levels ml ON ml.id = m.membership_level_id
    WHERE m.status = 'active'
    GROUP BY m.user_id
),
avg_progress AS (
    SELECT user_id, ROUND(AVG(progress_pct), 1) AS avg_progress_pct
    FROM vw_student_course_progress
    GROUP BY user_id
),
lesson_velocity AS (
    SELECT
        user_id,
        COUNT(*) FILTER (
            WHERE completed_at >= NOW() - INTERVAL '14 days'
        )                                                   AS lessons_last_14d,
        COUNT(*) FILTER (
            WHERE completed_at >= NOW() - INTERVAL '28 days'
              AND completed_at  < NOW() - INTERVAL '14 days'
        )                                                   AS lessons_prior_14d,
        MAX(completed_at)                                   AS last_lesson_completed_at
    FROM lesson_progress
    WHERE completed_at IS NOT NULL
    GROUP BY user_id
),
scored AS (
    SELECT
        u.id                                                            AS user_id,
        u.full_name,
        u.email,
        u.last_seen_at,
        EXTRACT(DAY FROM NOW() - u.last_seen_at)::INTEGER               AS days_since_last_seen,
        EXTRACT(DAY FROM NOW() - lv.last_lesson_completed_at)::INTEGER  AS days_since_last_lesson,
        sub.active_subscription_names,
        COALESCE(ap.avg_progress_pct, 0)                                AS avg_progress_pct,
        COALESCE(lv.lessons_last_14d, 0)                                AS lessons_completed_last_14d,
        COALESCE(lv.lessons_prior_14d, 0)                               AS lessons_completed_prior_14d,
        CASE
            WHEN COALESCE(lv.lessons_prior_14d, 0) = 0
             AND COALESCE(lv.lessons_last_14d, 0)  = 0 THEN NULL
            WHEN COALESCE(lv.lessons_prior_14d, 0) = 0       THEN 100.0
            ELSE ROUND(
                (COALESCE(lv.lessons_last_14d, 0)
                 - COALESCE(lv.lessons_prior_14d, 0))::NUMERIC
                / lv.lessons_prior_14d * 100, 1
            )
        END                                                             AS velocity_change_pct,
        -- Inactivity component (40%)
        CASE
            WHEN u.last_seen_at >= NOW() - INTERVAL '7 days'  THEN 0
            WHEN u.last_seen_at >= NOW() - INTERVAL '14 days' THEN 25
            WHEN u.last_seen_at >= NOW() - INTERVAL '30 days' THEN 50
            WHEN u.last_seen_at >= NOW() - INTERVAL '60 days' THEN 75
            ELSE 100
        END                                                             AS inactivity_component,
        -- Velocity component (35%)
        CASE
            WHEN COALESCE(lv.lessons_prior_14d, 0) = 0
             AND COALESCE(lv.lessons_last_14d, 0)  = 0 THEN 75
            WHEN COALESCE(lv.lessons_prior_14d, 0) = 0           THEN 0
            WHEN COALESCE(lv.lessons_last_14d, 0)::NUMERIC
                 / lv.lessons_prior_14d >= 0.75                   THEN 0
            WHEN COALESCE(lv.lessons_last_14d, 0)::NUMERIC
                 / lv.lessons_prior_14d >= 0.50                   THEN 25
            WHEN COALESCE(lv.lessons_last_14d, 0)::NUMERIC
                 / lv.lessons_prior_14d >= 0.25                   THEN 50
            WHEN COALESCE(lv.lessons_last_14d, 0) > 0             THEN 75
            ELSE 100
        END                                                             AS velocity_component,
        -- Progress component (25%)
        CASE
            WHEN COALESCE(ap.avg_progress_pct, 0) >= 75 THEN 0
            WHEN COALESCE(ap.avg_progress_pct, 0) >= 50 THEN 25
            WHEN COALESCE(ap.avg_progress_pct, 0) >= 25 THEN 50
            ELSE 75
        END                                                             AS progress_component
    FROM users u
    JOIN active_students ast ON ast.user_id = u.id
    LEFT JOIN subscriptions sub ON sub.user_id = u.id
    LEFT JOIN avg_progress ap    ON ap.user_id = u.id
    LEFT JOIN lesson_velocity lv ON lv.user_id = u.id
)
SELECT
    user_id,
    full_name,
    email,
    last_seen_at,
    days_since_last_seen,
    days_since_last_lesson,
    active_subscription_names,
    avg_progress_pct,
    lessons_completed_last_14d,
    lessons_completed_prior_14d,
    velocity_change_pct,
    inactivity_component,
    velocity_component,
    progress_component,
    ROUND(
        0.40 * inactivity_component
        + 0.35 * velocity_component
        + 0.25 * progress_component
    )::INTEGER                                                          AS risk_score,
    CASE
        WHEN ROUND(
            0.40 * inactivity_component
            + 0.35 * velocity_component
            + 0.25 * progress_component
        )::INTEGER >= 75 THEN 'critical'
        WHEN ROUND(
            0.40 * inactivity_component
            + 0.35 * velocity_component
            + 0.25 * progress_component
        )::INTEGER >= 50 THEN 'high'
        WHEN ROUND(
            0.40 * inactivity_component
            + 0.35 * velocity_component
            + 0.25 * progress_component
        )::INTEGER >= 25 THEN 'medium'
        ELSE 'low'
    END                                                                 AS risk_level
FROM scored
ORDER BY risk_score DESC, days_since_last_seen DESC;


-- ============================================================================
-- 5. Subscription-level overview
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_subscription_summary
-- One row per membership plan: subscriber counts by status.
-- "Engaged" = active subscriber who completed at least 1 lesson.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_subscription_summary AS
SELECT
    ml.id                                                                    AS membership_level_id,
    ml.name                                                                  AS level_name,
    COUNT(m.id) FILTER (WHERE m.status = 'active')                           AS active_count,
    COUNT(m.id) FILTER (WHERE m.status = 'pending')                          AS pending_count,
    COUNT(m.id) FILTER (WHERE m.status = 'expired')                          AS expired_count,
    COUNT(m.id) FILTER (WHERE m.status = 'inactive')                         AS inactive_count,
    COUNT(m.id)                                                               AS total_count,
    COUNT(DISTINCT m.user_id) FILTER (
        WHERE m.status = 'active'
          AND EXISTS (
              SELECT 1 FROM lesson_progress lp
              WHERE lp.user_id = m.user_id AND lp.completed_at IS NOT NULL
          )
    )                                                                         AS engaged_active_count
FROM membership_levels ml
LEFT JOIN memberships m ON m.membership_level_id = ml.id
GROUP BY ml.id, ml.name
ORDER BY ml.name;


-- ----------------------------------------------------------------------------
-- vw_subscription_engagement
-- Full engagement dashboard per subscription plan (active subscribers only).
-- Includes: avg progress, study hours, risk distribution.
-- No quiz accuracy. No enrollment metrics.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_subscription_engagement AS
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

    -- Risk distribution among active subscribers
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


-- ----------------------------------------------------------------------------
-- vw_subscription_weekly_trend
-- Weekly trend per subscription plan: active students, lessons completed,
-- estimated study hours.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_subscription_weekly_trend AS
SELECT
    DATE_TRUNC('week', lp.completed_at)::DATE           AS week_start,
    ml.name                                              AS subscription_name,
    COUNT(DISTINCT lp.user_id)                           AS active_students,
    COUNT(*)                                             AS lessons_completed,
    ROUND(
        COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 2
    )                                                    AS estimated_hours
FROM lesson_progress lp
LEFT JOIN lesson_videos lv    ON lv.lesson_id = lp.lesson_id
JOIN memberships m            ON m.user_id    = lp.user_id AND m.status = 'active'
JOIN membership_levels ml     ON ml.id        = m.membership_level_id
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.completed_at), ml.id, ml.name
ORDER BY week_start DESC, subscription_name;


-- ----------------------------------------------------------------------------
-- vw_subscription_course_completion
-- Per subscription plan per course: activity-based progress (NOT enrollment).
-- Uses lesson_progress to find which courses active subscribers have watched.
-- Only shows courses where at least one active subscriber has activity.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_subscription_course_completion AS
WITH course_totals AS (
    SELECT
        s.course_id,
        COUNT(l.id) AS total_lessons
    FROM sections s
    JOIN lessons l ON l.section_id = s.id
    GROUP BY s.course_id
),
active_sub_users AS (
    SELECT
        m.user_id,
        m.membership_level_id
    FROM memberships m
    WHERE m.status = 'active'
),
subscriber_course_activity AS (
    SELECT
        asu.membership_level_id,
        asu.user_id,
        s.course_id,
        COUNT(DISTINCT lp.lesson_id) AS completed_lessons
    FROM active_sub_users asu
    JOIN lesson_progress lp ON lp.user_id = asu.user_id
    JOIN lessons l          ON l.id  = lp.lesson_id
    JOIN sections s         ON s.id  = l.section_id
    WHERE lp.completed_at IS NOT NULL
    GROUP BY asu.membership_level_id, asu.user_id, s.course_id
)
SELECT
    ml.id                                                                    AS membership_level_id,
    ml.name                                                                  AS level_name,
    c.id                                                                     AS course_id,
    c.name                                                                   AS course_name,
    ct.total_lessons,
    COUNT(DISTINCT sca.user_id)                                              AS students_with_activity,
    ROUND(
        AVG(
            CASE
                WHEN ct.total_lessons = 0 THEN 0
                ELSE (sca.completed_lessons::NUMERIC / ct.total_lessons) * 100
            END
        ), 1
    )                                                                        AS avg_progress_pct,
    COUNT(DISTINCT sca.user_id) FILTER (
        WHERE sca.completed_lessons >= ct.total_lessons AND ct.total_lessons > 0
    )                                                                        AS students_completed,
    CASE
        WHEN COUNT(DISTINCT sca.user_id) = 0 THEN NULL
        ELSE ROUND(
            COUNT(DISTINCT sca.user_id) FILTER (
                WHERE sca.completed_lessons >= ct.total_lessons AND ct.total_lessons > 0
            )::NUMERIC
            / COUNT(DISTINCT sca.user_id) * 100, 1
        )
    END                                                                      AS completion_rate_pct
FROM subscriber_course_activity sca
JOIN membership_levels ml   ON ml.id  = sca.membership_level_id
JOIN courses c              ON c.id   = sca.course_id
JOIN course_totals ct       ON ct.course_id = sca.course_id
GROUP BY ml.id, ml.name, c.id, c.name, ct.total_lessons
ORDER BY ml.name, c.name;


-- ============================================================================
-- 6. Content analytics
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_lesson_stats
-- Per lesson: completion count, avg rating, comments.
-- REMOVED: total_enrolled, completion_rate_pct (enrollment-based, always zero).
-- ----------------------------------------------------------------------------

CREATE VIEW vw_lesson_stats AS
SELECT
    l.id                                                    AS lesson_id,
    l.mk_id                                                 AS lesson_mk_id,
    l.title,
    l.position                                              AS lesson_position,
    s.id                                                    AS section_id,
    s.name                                                  AS section_name,
    c.id                                                    AS course_id,
    c.name                                                  AS course_name,
    COUNT(DISTINCT lp.user_id)                              AS total_completions,
    COUNT(DISTINCT lr.user_id)                              AS total_ratings,
    ROUND(AVG(lr.stars), 1)                                 AS avg_stars,
    COUNT(DISTINCT co.id)                                   AS total_comments
FROM lessons l
JOIN sections s              ON s.id        = l.section_id
JOIN courses c               ON c.id        = s.course_id
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.completed_at IS NOT NULL
LEFT JOIN lesson_ratings lr  ON lr.lesson_id = l.id
LEFT JOIN comments co        ON co.lesson_id = l.id
GROUP BY l.id, l.mk_id, l.title, l.position, s.id, s.name, c.id, c.name;


-- ----------------------------------------------------------------------------
-- vw_lesson_stats_enhanced
-- Extends vw_lesson_stats with video duration and file download metrics.
-- REMOVED: total_enrolled, completion_rate_pct, download_rate_pct (enrollment-based).
-- ----------------------------------------------------------------------------

CREATE VIEW vw_lesson_stats_enhanced AS
SELECT
    l.id                                                    AS lesson_id,
    l.mk_id                                                 AS lesson_mk_id,
    l.title,
    l.position                                              AS lesson_position,
    s.id                                                    AS section_id,
    s.name                                                  AS section_name,
    c.id                                                    AS course_id,
    c.name                                                  AS course_name,
    COUNT(DISTINCT lp.user_id)                              AS total_completions,
    COUNT(DISTINCT lr.user_id)                              AS total_ratings,
    ROUND(AVG(lr.stars), 1)                                 AS avg_stars,
    COUNT(DISTINCT co.id)                                   AS total_comments,
    -- Video metadata
    lv.duration_seconds                                     AS video_duration_seconds,
    TO_CHAR(
        MAKE_INTERVAL(secs => COALESCE(lv.duration_seconds, 0)),
        'HH24:MI:SS'
    )                                                       AS video_duration_display,
    (lv.duration_seconds IS NOT NULL)                       AS has_video,
    -- Supplementary files
    COUNT(DISTINCT lf.id)                                   AS file_count,
    (COUNT(DISTINCT lf.id) > 0)                             AS has_files,
    -- File download metrics
    COUNT(DISTINCT fd.id)                                   AS total_file_downloads,
    COUNT(DISTINCT fd.user_id)                              AS unique_file_downloaders
FROM lessons l
JOIN sections s                     ON s.id        = l.section_id
JOIN courses c                      ON c.id        = s.course_id
LEFT JOIN lesson_progress lp        ON lp.lesson_id = l.id AND lp.completed_at IS NOT NULL
LEFT JOIN lesson_ratings lr         ON lr.lesson_id = l.id
LEFT JOIN comments co               ON co.lesson_id = l.id
LEFT JOIN lesson_videos lv          ON lv.lesson_id = l.id
LEFT JOIN lesson_files lf           ON lf.lesson_id = l.id
LEFT JOIN lesson_file_downloads fd  ON fd.lesson_id = l.id
GROUP BY l.id, l.mk_id, l.title, l.position,
         s.id, s.name,
         c.id, c.name,
         lv.duration_seconds;


-- ----------------------------------------------------------------------------
-- vw_course_funnel
-- Completion funnel per course. REDESIGNED without enrollments.
-- Uses students_with_any_activity (>= 1 completed lesson) as funnel entry.
-- Funnel: activity -> started (same) -> halfway (>=50%) -> completed (100%)
-- ----------------------------------------------------------------------------

CREATE VIEW vw_course_funnel AS
WITH course_video_hours AS (
    SELECT
        s.course_id,
        ROUND(COALESCE(SUM(lv.duration_seconds), 0) / 3600.0, 1) AS total_video_hours
    FROM sections s
    JOIN lessons l         ON l.section_id = s.id
    LEFT JOIN lesson_videos lv ON lv.lesson_id = l.id
    GROUP BY s.course_id
),
student_milestones AS (
    SELECT
        cp.user_id,
        cp.course_id,
        cp.progress_pct,
        cp.completed_lessons
    FROM vw_student_course_progress cp
),
milestone_days AS (
    SELECT
        sm.user_id,
        sm.course_id,
        sm.progress_pct,
        EXTRACT(DAY FROM MAX(lp.completed_at) - MIN(lp.completed_at))::INTEGER AS days_elapsed
    FROM student_milestones sm
    JOIN sections s  ON s.course_id = sm.course_id
    JOIN lessons l   ON l.section_id = s.id
    JOIN lesson_progress lp
        ON lp.lesson_id = l.id
       AND lp.user_id   = sm.user_id
       AND lp.completed_at IS NOT NULL
    GROUP BY sm.user_id, sm.course_id, sm.progress_pct
)
SELECT
    c.id                                                                    AS course_id,
    c.name                                                                  AS course_name,
    cat.name                                                                AS category_name,
    COUNT(DISTINCT l.id)                                                    AS total_lessons,
    COALESCE(cvh.total_video_hours, 0)                                      AS total_video_hours,
    COUNT(DISTINCT sm.user_id)                                              AS students_with_any_activity,
    COUNT(DISTINCT sm.user_id) FILTER (WHERE sm.completed_lessons >= 1)    AS started_students,
    COUNT(DISTINCT sm.user_id) FILTER (WHERE sm.progress_pct >= 50)        AS halfway_students,
    COUNT(DISTINCT sm.user_id) FILTER (WHERE sm.progress_pct >= 100)       AS completed_students,
    CASE
        WHEN COUNT(DISTINCT sm.user_id) = 0 THEN NULL
        ELSE ROUND(
            COUNT(DISTINCT sm.user_id) FILTER (WHERE sm.progress_pct >= 100)::NUMERIC
            / COUNT(DISTINCT sm.user_id) * 100, 1
        )
    END                                                                     AS completion_rate_pct,
    ROUND(AVG(md.days_elapsed) FILTER (WHERE md.progress_pct >= 50), 0)::INTEGER
                                                                            AS avg_days_to_50pct,
    ROUND(AVG(md.days_elapsed) FILTER (WHERE md.progress_pct >= 100), 0)::INTEGER
                                                                            AS avg_days_to_100pct
FROM courses c
LEFT JOIN categories cat          ON cat.id       = c.category_id
LEFT JOIN course_video_hours cvh  ON cvh.course_id = c.id
LEFT JOIN sections s              ON s.course_id   = c.id
LEFT JOIN lessons l               ON l.section_id  = s.id
LEFT JOIN student_milestones sm   ON sm.course_id  = c.id
LEFT JOIN milestone_days md       ON md.course_id  = c.id AND md.user_id = sm.user_id
GROUP BY c.id, c.name, cat.name, cvh.total_video_hours;


-- ----------------------------------------------------------------------------
-- vw_lesson_ratings_summary
-- Star distribution (1-5) per lesson with average, sorted best-first.
-- Unchanged from 025 (no enrollment dependency).
-- ----------------------------------------------------------------------------

CREATE VIEW vw_lesson_ratings_summary AS
SELECT
    l.id                                                    AS lesson_id,
    l.title,
    s.name                                                  AS section_name,
    c.name                                                  AS course_name,
    COUNT(lr.id)                                            AS total_ratings,
    ROUND(AVG(lr.stars), 2)                                 AS avg_stars,
    COUNT(lr.id) FILTER (WHERE lr.stars = 5)                AS stars_5,
    COUNT(lr.id) FILTER (WHERE lr.stars = 4)                AS stars_4,
    COUNT(lr.id) FILTER (WHERE lr.stars = 3)                AS stars_3,
    COUNT(lr.id) FILTER (WHERE lr.stars = 2)                AS stars_2,
    COUNT(lr.id) FILTER (WHERE lr.stars = 1)                AS stars_1
FROM lesson_ratings lr
JOIN lessons l  ON l.id  = lr.lesson_id
JOIN sections s ON s.id  = l.section_id
JOIN courses c  ON c.id  = s.course_id
GROUP BY l.id, l.title, s.name, c.name
ORDER BY avg_stars DESC;
