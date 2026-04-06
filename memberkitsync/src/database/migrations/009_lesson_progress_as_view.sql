-- Migration 009: Drop lesson_progress table, replace with view over user_activities
-- Only completed lessons are tracked (rows where completed_at IS NOT NULL in trackable).
-- The progress integer field is dropped entirely — completion is binary.

-- ============================================================================
-- 1. Drop lesson_progress (CASCADE removes indexes, trigger, RLS policies)
-- ============================================================================

DROP TABLE IF EXISTS lesson_progress CASCADE;

-- ============================================================================
-- 2. Create vw_lesson_progress
-- Returns the latest completed event per (user, lesson) from user_activities.
-- A lesson is considered complete when trackable->>'completed_at' is not null.
-- DISTINCT ON ensures one row per (user_id, lesson_id) — the most recent event.
-- ============================================================================

CREATE VIEW vw_lesson_progress AS
SELECT DISTINCT ON (ua.user_id, l.id)
    ua.user_id,
    l.id                                                AS lesson_id,
    (ua.trackable->>'completed_at')::TIMESTAMPTZ        AS completed_at
FROM user_activities ua
JOIN lessons l ON l.mk_id = ua.mk_lesson_id
WHERE ua.event_type = 'lesson_status.saved'
  AND ua.mk_lesson_id IS NOT NULL
  AND ua.trackable->>'completed_at' IS NOT NULL
ORDER BY ua.user_id, l.id, ua.occurred_at DESC;

-- ============================================================================
-- 3. Recreate vw_student_course_progress (was joined on lesson_progress)
-- ============================================================================

CREATE OR REPLACE VIEW vw_student_course_progress AS
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
JOIN users u         ON u.id = e.user_id
JOIN courses c       ON c.id = e.course_id
JOIN sections s      ON s.course_id = c.id
JOIN lessons l       ON l.section_id = s.id
LEFT JOIN vw_lesson_progress lp
    ON lp.lesson_id = l.id
    AND lp.user_id  = e.user_id
GROUP BY e.user_id, e.course_id, c.name, u.full_name, u.email, e.status;

-- ============================================================================
-- 4. Recreate vw_student_section_progress (was joined on lesson_progress)
-- ============================================================================

CREATE OR REPLACE VIEW vw_student_section_progress AS
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
JOIN users u         ON u.id = e.user_id
JOIN courses c       ON c.id = e.course_id
JOIN sections s      ON s.course_id = c.id
JOIN lessons l       ON l.section_id = s.id
LEFT JOIN vw_lesson_progress lp
    ON lp.lesson_id = l.id
    AND lp.user_id  = e.user_id
GROUP BY e.user_id, s.id, s.course_id, c.name, s.name, s.position, u.full_name;

-- ============================================================================
-- 5. Recreate fn_student_full_progress
-- Drops the 'progress' field; 'completed' is derived from presence in the view.
-- ============================================================================

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
                                AND lp.user_id  = p_user_id
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
