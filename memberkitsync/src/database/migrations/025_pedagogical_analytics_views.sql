-- ============================================================================
-- Migration 025: Pedagogical Analytics Views — Full Suite
--
-- Context:
--   All views were dropped in migration 024 (clean slate).
--   This migration rebuilds everything from scratch using the normalized
--   activity tables (lesson_progress, forum_posts, forum_comments,
--   lesson_file_downloads). The legacy table user_activities is NOT used.
--   Quiz data (quiz_attempts) is intentionally excluded from all analytics.
--
-- Groups:
--   1. Performance indexes
--   2. Base views + functions (vw_lesson_progress, course/section progress, fn_*)
--   3. Weekly global metrics (vw_weekly_*)
--   4. Individual pedagogical tracking (vw_student_*)
--   5. Subscription-level overview (vw_subscription_*)
--   6. Content analytics (vw_lesson_stats*, vw_course_funnel, vw_lesson_ratings_*)
-- ============================================================================


-- ============================================================================
-- 1. Performance indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lesson_progress_completed_at
    ON lesson_progress(completed_at)
    WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_file_downloads_occurred_at
    ON lesson_file_downloads(occurred_at);

CREATE INDEX IF NOT EXISTS idx_forum_posts_occurred_at
    ON forum_posts(occurred_at);

CREATE INDEX IF NOT EXISTS idx_forum_comments_occurred_at
    ON forum_comments(occurred_at);


-- ============================================================================
-- 2. Base views + functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_lesson_progress
-- Thin abstraction over the physical lesson_progress table.
-- Exposes occurred_at so downstream views can use it for weekly bucketing.
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
-- Completion % per student per course (based on enrollment).
-- ----------------------------------------------------------------------------

CREATE VIEW vw_student_course_progress AS
SELECT
    e.user_id,
    e.course_id,
    c.name                                              AS course_name,
    u.full_name                                         AS student_name,
    u.email                                             AS student_email,
    e.status                                            AS enrollment_status,
    COUNT(l.id)                                         AS total_lessons,
    COUNT(lp.lesson_id)                                 AS completed_lessons,
    CASE
        WHEN COUNT(l.id) = 0 THEN 0
        ELSE ROUND(
            (COUNT(lp.lesson_id)::NUMERIC / COUNT(l.id)) * 100, 1
        )
    END                                                 AS progress_pct,
    MAX(lp.completed_at)                                AS last_activity_at
FROM enrollments e
JOIN users u         ON u.id          = e.user_id
JOIN courses c       ON c.id          = e.course_id
JOIN sections s      ON s.course_id   = c.id
JOIN lessons l       ON l.section_id  = s.id
LEFT JOIN vw_lesson_progress lp
    ON lp.lesson_id = l.id
   AND lp.user_id   = e.user_id
GROUP BY e.user_id, e.course_id, c.name, u.full_name, u.email, e.status;


-- ----------------------------------------------------------------------------
-- vw_student_section_progress
-- Completion % per student per section (module-level granularity).
-- ----------------------------------------------------------------------------

CREATE VIEW vw_student_section_progress AS
SELECT
    e.user_id,
    s.id                                                AS section_id,
    s.course_id,
    c.name                                              AS course_name,
    s.name                                              AS section_name,
    s.position                                          AS section_position,
    u.full_name                                         AS student_name,
    COUNT(l.id)                                         AS total_lessons,
    COUNT(lp.lesson_id)                                 AS completed_lessons,
    CASE
        WHEN COUNT(l.id) = 0 THEN 0
        ELSE ROUND(
            (COUNT(lp.lesson_id)::NUMERIC / COUNT(l.id)) * 100, 1
        )
    END                                                 AS progress_pct
FROM enrollments e
JOIN users u         ON u.id          = e.user_id
JOIN courses c       ON c.id          = e.course_id
JOIN sections s      ON s.course_id   = c.id
JOIN lessons l       ON l.section_id  = s.id
LEFT JOIN vw_lesson_progress lp
    ON lp.lesson_id = l.id
   AND lp.user_id   = e.user_id
GROUP BY e.user_id, s.id, s.course_id, c.name, s.name, s.position, u.full_name;


-- ----------------------------------------------------------------------------
-- fn_student_full_progress(user_id)
-- Returns a fully nested JSON: courses → sections → lessons with completion.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_student_full_progress(p_user_id BIGINT)
RETURNS JSONB AS $$
SELECT COALESCE(
    JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'course_id',         c.id,
            'course_name',       c.name,
            'enrollment_status', e.status,
            'sections', (
                SELECT COALESCE(JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'section_id',   s.id,
                        'section_name', s.name,
                        'position',     s.position,
                        'lessons', (
                            SELECT COALESCE(JSONB_AGG(
                                JSONB_BUILD_OBJECT(
                                    'lesson_id',    l.id,
                                    'title',        l.title,
                                    'position',     l.position,
                                    'completed',    (lp.lesson_id IS NOT NULL),
                                    'completed_at', lp.completed_at
                                ) ORDER BY l.position
                            ), '[]'::JSONB)
                            FROM lessons l
                            LEFT JOIN vw_lesson_progress lp
                                ON lp.lesson_id = l.id
                               AND lp.user_id   = p_user_id
                            WHERE l.section_id = s.id
                        )
                    ) ORDER BY s.position
                ), '[]'::JSONB)
                FROM sections s
                WHERE s.course_id = c.id
            )
        )
    ),
    '[]'::JSONB
)
FROM enrollments e
JOIN courses c ON c.id = e.course_id
WHERE e.user_id = p_user_id;
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
-- All views use lesson_progress (NOT user_activities).
-- "Active" = completed at least 1 lesson in that week.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_weekly_lessons_completed
-- Total lesson completions per ISO week (Mon–Sun).
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
-- Lessons without a video contribute 0 hours but still count as completed.
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
-- Columns:
--   Identity:         user_id, mk_id, full_name, email, blocked, sign_in_count
--   Login:            last_seen_at, days_since_last_seen
--   Subscriptions:    active_subscriptions, active_subscription_names
--   Enrollments:      enrolled_courses
--   Lesson progress:  total_lessons_completed, last_lesson_completed_at,
--                     days_since_last_lesson, estimated_study_hours
--   Ratings:          total_lessons_rated, avg_rating_given
--   Comments:         total_comments
--   Forum:            total_forum_posts, total_forum_comments, last_forum_activity_at
--   Downloads:        total_file_downloads, last_download_at
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
),
enrollment_stats AS (
    SELECT user_id, COUNT(DISTINCT course_id) AS enrolled_courses
    FROM enrollments
    WHERE status = 'active'
    GROUP BY user_id
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

    COALESCE(es.enrolled_courses, 0)                                        AS enrolled_courses,

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
LEFT JOIN subscription_stats ss   ON ss.user_id  = u.id
LEFT JOIN enrollment_stats es     ON es.user_id  = u.id
LEFT JOIN lesson_stats ls         ON ls.user_id  = u.id
LEFT JOIN rating_stats rs         ON rs.user_id  = u.id
LEFT JOIN comment_stats cs        ON cs.user_id  = u.id
LEFT JOIN forum_post_stats fps    ON fps.user_id = u.id
LEFT JOIN forum_comment_stats fcs ON fcs.user_id = u.id
LEFT JOIN download_stats ds       ON ds.user_id  = u.id;


-- ----------------------------------------------------------------------------
-- vw_student_weekly_activity
-- All activity types aggregated per student per week.
-- Use WHERE user_id = X to get the full timeline for a single student.
-- Columns:
--   user_id, full_name, week_start,
--   lessons_completed, estimated_hours,
--   forum_posts, forum_comments, file_downloads,
--   engagement_points (weighted sum to rank activity intensity)
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
-- Weekly lesson completion count per student + cumulative total + estimated
-- study hours + week-over-week change.
-- Use WHERE user_id = X to get a student's learning curve over time.
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
-- Composite risk score (0–100) for all students with active subscriptions.
-- Higher score = higher risk of disengagement.
--
-- Score components (each 0/25/50/75/100):
--   40%  inactivity  — days since last login
--   35%  velocity    — lesson completion rate: last 14d vs prior 14d
--   25%  progress    — average course completion %
--
-- Risk levels:  critical ≥ 75 | high ≥ 50 | medium ≥ 25 | low < 25
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
enrollments_agg AS (
    SELECT user_id, COUNT(DISTINCT course_id) AS enrolled_courses
    FROM enrollments
    WHERE status = 'active'
    GROUP BY user_id
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
        COALESCE(ea.enrolled_courses, 0)                                AS enrolled_courses,
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
    LEFT JOIN enrollments_agg ea ON ea.user_id = u.id
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
    enrolled_courses,
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
-- Uses inline CTEs to avoid fan-out.
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
-- estimated study hours. Useful for monitoring engagement over time per plan.
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
-- Per subscription plan per course: enrollment count, avg progress %,
-- and completion rate (students at 100%).
-- Uses the path: membership_level → classrooms → enrollments → courses.
-- ----------------------------------------------------------------------------

CREATE VIEW vw_subscription_course_completion AS
SELECT
    ml.id                                                                    AS membership_level_id,
    ml.name                                                                  AS level_name,
    c.id                                                                     AS course_id,
    c.name                                                                   AS course_name,
    COUNT(DISTINCT e.user_id)                                                AS enrolled_students,
    ROUND(AVG(COALESCE(cp.progress_pct, 0)), 1)                              AS avg_progress_pct,
    COUNT(DISTINCT e.user_id) FILTER (WHERE cp.progress_pct = 100)           AS completed_students,
    CASE
        WHEN COUNT(DISTINCT e.user_id) = 0 THEN NULL
        ELSE ROUND(
            COUNT(DISTINCT e.user_id) FILTER (WHERE cp.progress_pct = 100)::NUMERIC
            / COUNT(DISTINCT e.user_id) * 100, 1
        )
    END                                                                      AS completion_rate_pct
FROM membership_levels ml
JOIN membership_level_classrooms mlc ON mlc.membership_level_id = ml.id
JOIN classrooms cl                   ON cl.id  = mlc.classroom_id
JOIN enrollments e                   ON e.classroom_id = cl.id AND e.status = 'active'
JOIN courses c                       ON c.id   = e.course_id
LEFT JOIN vw_student_course_progress cp
    ON cp.user_id   = e.user_id
   AND cp.course_id = c.id
GROUP BY ml.id, ml.name, c.id, c.name
ORDER BY ml.name, c.name;


-- ============================================================================
-- 6. Content analytics
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_lesson_stats
-- Per lesson: completion count, completion rate vs enrolled, avg rating, comments.
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
    COUNT(DISTINCT e.user_id)                               AS total_enrolled,
    CASE
        WHEN COUNT(DISTINCT e.user_id) = 0 THEN NULL
        ELSE ROUND(
            COUNT(DISTINCT lp.user_id)::NUMERIC
            / COUNT(DISTINCT e.user_id) * 100, 1
        )
    END                                                     AS completion_rate_pct,
    COUNT(DISTINCT lr.user_id)                              AS total_ratings,
    ROUND(AVG(lr.stars), 1)                                 AS avg_stars,
    COUNT(DISTINCT co.id)                                   AS total_comments
FROM lessons l
JOIN sections s              ON s.id        = l.section_id
JOIN courses c               ON c.id        = s.course_id
LEFT JOIN enrollments e      ON e.course_id = c.id AND e.status = 'active'
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.completed_at IS NOT NULL
LEFT JOIN lesson_ratings lr  ON lr.lesson_id = l.id
LEFT JOIN comments co        ON co.lesson_id = l.id
GROUP BY l.id, l.mk_id, l.title, l.position, s.id, s.name, c.id, c.name;


-- ----------------------------------------------------------------------------
-- vw_lesson_stats_enhanced
-- Extends vw_lesson_stats with video duration and file download metrics.
-- Separate view to avoid breaking consumers of vw_lesson_stats.
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
    COUNT(DISTINCT e.user_id)                               AS total_enrolled,
    CASE
        WHEN COUNT(DISTINCT e.user_id) = 0 THEN NULL
        ELSE ROUND(
            COUNT(DISTINCT lp.user_id)::NUMERIC
            / COUNT(DISTINCT e.user_id) * 100, 1
        )
    END                                                     AS completion_rate_pct,
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
    COUNT(DISTINCT fd.user_id)                              AS unique_file_downloaders,
    CASE
        WHEN COUNT(DISTINCT e.user_id) = 0 THEN NULL
        ELSE ROUND(
            COUNT(DISTINCT fd.user_id)::NUMERIC
            / COUNT(DISTINCT e.user_id) * 100, 1
        )
    END                                                     AS download_rate_pct
FROM lessons l
JOIN sections s                     ON s.id        = l.section_id
JOIN courses c                      ON c.id        = s.course_id
LEFT JOIN enrollments e             ON e.course_id = c.id AND e.status = 'active'
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
-- Completion funnel per course:
--   enrolled → started (≥1 lesson) → halfway (≥50%) → completed (100%)
-- Also includes total video hours and avg days to reach each milestone.
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
        cp.completed_lessons,
        EXTRACT(DAY FROM MAX(lp.completed_at) - MIN(lp.completed_at))::INTEGER AS days_elapsed
    FROM vw_student_course_progress cp
    JOIN sections s  ON s.course_id = cp.course_id
    JOIN lessons l   ON l.section_id = s.id
    JOIN lesson_progress lp
        ON lp.lesson_id = l.id
       AND lp.user_id   = cp.user_id
       AND lp.completed_at IS NOT NULL
    GROUP BY cp.user_id, cp.course_id, cp.progress_pct, cp.completed_lessons
)
SELECT
    c.id                                                                    AS course_id,
    c.name                                                                  AS course_name,
    cat.name                                                                AS category_name,
    COUNT(DISTINCT l.id)                                                    AS total_lessons,
    COALESCE(cvh.total_video_hours, 0)                                      AS total_video_hours,
    COUNT(DISTINCT e.user_id)                                               AS enrolled_students,
    COUNT(DISTINCT sm.user_id) FILTER (WHERE sm.completed_lessons >= 1)    AS started_students,
    COUNT(DISTINCT sm.user_id) FILTER (WHERE sm.progress_pct >= 50)        AS halfway_students,
    COUNT(DISTINCT sm.user_id) FILTER (WHERE sm.progress_pct = 100)        AS completed_students,
    CASE
        WHEN COUNT(DISTINCT e.user_id) = 0 THEN NULL
        ELSE ROUND(
            COUNT(DISTINCT sm.user_id) FILTER (WHERE sm.progress_pct = 100)::NUMERIC
            / COUNT(DISTINCT e.user_id) * 100, 1
        )
    END                                                                     AS completion_rate_pct,
    ROUND(AVG(sm.days_elapsed) FILTER (WHERE sm.progress_pct >= 50), 0)::INTEGER
                                                                            AS avg_days_to_50pct,
    ROUND(AVG(sm.days_elapsed) FILTER (WHERE sm.progress_pct = 100), 0)::INTEGER
                                                                            AS avg_days_to_100pct
FROM courses c
LEFT JOIN categories cat          ON cat.id       = c.category_id
LEFT JOIN course_video_hours cvh  ON cvh.course_id = c.id
LEFT JOIN sections s              ON s.course_id   = c.id
LEFT JOIN lessons l               ON l.section_id  = s.id
LEFT JOIN enrollments e           ON e.course_id   = c.id AND e.status = 'active'
LEFT JOIN student_milestones sm   ON sm.course_id  = c.id
GROUP BY c.id, c.name, cat.name, cvh.total_video_hours;


-- ----------------------------------------------------------------------------
-- vw_lesson_ratings_summary
-- Star distribution (1–5) per lesson with average, sorted best-first.
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
