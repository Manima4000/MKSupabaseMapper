-- ============================================================================
-- Migration 017: Normalize user_activities into dedicated tables
--
-- Context:
--   user_activities stores 7 distinct trackable_types mixed in one table.
--   Each type now gets its own table for proper querying and indexing.
--
--   Types being normalized:
--     LessonStatus        → lesson_progress    (re-create as physical table)
--     ForumPost           → forum_posts         (new)
--     ForumComment        → forum_comments      (new)
--     lesson_file.downloaded → lesson_file_downloads (new)
--
--   Types already in dedicated tables (synced separately):
--     Comment             → comments            (no change needed)
--     Rating              → lesson_ratings      (no change needed)
--     QuizAttempt         → quiz_attempts       (no change needed)
-- ============================================================================

-- ============================================================================
-- 1. Re-create lesson_progress as a physical table
--    (was dropped in 009 and replaced by a view over user_activities)
-- ============================================================================

-- Drop the view first (CASCADE drops dependent objects that will be recreated)
DROP VIEW IF EXISTS vw_lesson_progress CASCADE;

CREATE TABLE lesson_progress (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- mk_id = the user_activity.mk_id; NULL for webhook-only events with no MK activity id
    mk_id           INTEGER UNIQUE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id       BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at    TIMESTAMPTZ,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user_id   ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);

CREATE TRIGGER set_lesson_progress_updated_at
    BEFORE UPDATE ON lesson_progress
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Populate from user_activities (keep only the latest event per user+lesson)
INSERT INTO lesson_progress (mk_id, user_id, lesson_id, completed_at, occurred_at, created_at)
SELECT DISTINCT ON (ua.user_id, l.id)
    ua.mk_id,
    ua.user_id,
    l.id                                                    AS lesson_id,
    (ua.trackable->>'completed_at')::TIMESTAMPTZ            AS completed_at,
    ua.occurred_at,
    ua.created_at
FROM user_activities ua
JOIN lessons l ON l.mk_id = ua.mk_lesson_id
WHERE ua.event_type = 'LessonStatus'
  AND ua.mk_lesson_id IS NOT NULL
ORDER BY ua.user_id, l.id, ua.occurred_at DESC
ON CONFLICT (user_id, lesson_id) DO NOTHING;


-- ============================================================================
-- 2. Re-create vw_lesson_progress as a simple SELECT over the physical table
--    All dependent views (vw_student_course_progress, vw_inactive_students,
--    fn_student_full_progress, etc.) continue to work unchanged.
-- ============================================================================

CREATE VIEW vw_lesson_progress AS
SELECT
    user_id,
    lesson_id,
    completed_at
FROM lesson_progress;


-- ============================================================================
-- 3. Re-create views that were CASCADE-dropped above
--    (vw_student_course_progress, vw_student_section_progress,
--     fn_student_full_progress were created in migration 009 and depend on
--     vw_lesson_progress — they need to be recreated after the view.)
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


-- Re-create weekly analytics views (were also CASCADE-dropped)
CREATE OR REPLACE VIEW vw_weekly_lessons_completed AS
SELECT
    DATE_TRUNC('week', lp.occurred_at)::DATE    AS week_start,
    COUNT(DISTINCT (lp.user_id, lp.lesson_id))  AS completed_lessons
FROM lesson_progress lp
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.occurred_at)
ORDER BY week_start DESC;


CREATE OR REPLACE VIEW vw_weekly_active_students AS
SELECT
    DATE_TRUNC('week', lp.occurred_at)::DATE    AS week_start,
    COUNT(DISTINCT lp.user_id)                   AS active_students
FROM lesson_progress lp
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.occurred_at)
ORDER BY week_start DESC;


CREATE OR REPLACE VIEW vw_weekly_active_students_by_subscription AS
SELECT
    DATE_TRUNC('week', lp.occurred_at)::DATE    AS week_start,
    ml.name                                      AS subscription_name,
    COUNT(DISTINCT lp.user_id)                   AS active_students
FROM lesson_progress lp
JOIN memberships m
    ON m.user_id = lp.user_id
   AND m.status  = 'active'
JOIN membership_levels ml
    ON ml.id = m.membership_level_id
WHERE lp.completed_at IS NOT NULL
GROUP BY DATE_TRUNC('week', lp.occurred_at), ml.id, ml.name
ORDER BY week_start DESC, subscription_name;


-- ============================================================================
-- 4. Create forum_posts table
-- ============================================================================

CREATE TABLE forum_posts (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER UNIQUE NOT NULL,   -- trackable.id from user_activities
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    forum_id        INTEGER NOT NULL,          -- trackable.forum_id
    title           TEXT NOT NULL DEFAULT '',
    occurred_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forum_posts_user_id  ON forum_posts(user_id);
CREATE INDEX idx_forum_posts_forum_id ON forum_posts(forum_id);

CREATE TRIGGER set_forum_posts_updated_at
    BEFORE UPDATE ON forum_posts
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Populate from user_activities
INSERT INTO forum_posts (mk_id, user_id, forum_id, title, occurred_at, created_at)
SELECT
    (ua.trackable->>'id')::INTEGER                      AS mk_id,
    ua.user_id,
    COALESCE((ua.trackable->>'forum_id')::INTEGER, 0)   AS forum_id,
    COALESCE(ua.trackable->>'title', '')                AS title,
    ua.occurred_at,
    ua.created_at
FROM user_activities ua
WHERE ua.event_type = 'ForumPost'
  AND ua.trackable->>'id' IS NOT NULL
ON CONFLICT (mk_id) DO NOTHING;


-- ============================================================================
-- 5. Create forum_comments table
-- ============================================================================

CREATE TABLE forum_comments (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER UNIQUE NOT NULL,   -- trackable.id from user_activities
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    forum_post_id   INTEGER NOT NULL,          -- trackable.forum_post_id (MK id)
    content         TEXT NOT NULL DEFAULT '',
    occurred_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forum_comments_user_id      ON forum_comments(user_id);
CREATE INDEX idx_forum_comments_post_id      ON forum_comments(forum_post_id);

CREATE TRIGGER set_forum_comments_updated_at
    BEFORE UPDATE ON forum_comments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Populate from user_activities
INSERT INTO forum_comments (mk_id, user_id, forum_post_id, content, occurred_at, created_at)
SELECT
    (ua.trackable->>'id')::INTEGER                          AS mk_id,
    ua.user_id,
    COALESCE((ua.trackable->>'forum_post_id')::INTEGER, 0)  AS forum_post_id,
    COALESCE(ua.trackable->>'content', '')                  AS content,
    ua.occurred_at,
    ua.created_at
FROM user_activities ua
WHERE ua.event_type = 'ForumComment'
  AND ua.trackable->>'id' IS NOT NULL
ON CONFLICT (mk_id) DO NOTHING;


-- ============================================================================
-- 6. Create lesson_file_downloads table
--    Simple log: who (user_id) downloaded which file (file_id) from which lesson (lesson_id).
-- ============================================================================

CREATE TABLE lesson_file_downloads (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id       BIGINT REFERENCES lessons(id) ON DELETE SET NULL,
    file_id         INTEGER,        -- MK lesson_file id
    occurred_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Deduplication: same user cannot download at the exact same timestamp twice
    UNIQUE (user_id, occurred_at)
);

CREATE INDEX idx_lesson_file_downloads_user_id   ON lesson_file_downloads(user_id);
CREATE INDEX idx_lesson_file_downloads_lesson_id ON lesson_file_downloads(lesson_id);

-- Populate from user_activities
-- Note: activity sync does not capture file_id (trackable is null for this type),
-- so file_id will be NULL for these rows. Future webhook events will populate file_id.
INSERT INTO lesson_file_downloads (user_id, lesson_id, occurred_at, created_at)
SELECT
    ua.user_id,
    l.id                AS lesson_id,
    ua.occurred_at,
    ua.created_at
FROM user_activities ua
LEFT JOIN lessons l ON l.mk_id = ua.mk_lesson_id
WHERE ua.event_type = 'lesson_file.downloaded';
