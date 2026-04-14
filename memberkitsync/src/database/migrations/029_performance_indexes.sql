-- ============================================================================
-- Migration 029: Performance indexes for Power BI / analytics queries
--
-- Context:
--   With 1M+ lesson_progress rows, views that do full scans with GROUP BY
--   were timing out in Power BI. This migration adds targeted indexes to
--   eliminate heap accesses and reduce scan costs for the analytics views
--   created in migration 026.
--
-- Impact per index is documented below.
-- ============================================================================


-- ============================================================================
-- lesson_progress indexes
-- ============================================================================

-- Used by: vw_lesson_stats, vw_lesson_stats_enhanced, vw_course_funnel
-- Pattern: JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.completed_at IS NOT NULL
-- Problem: existing idx_lesson_progress_lesson_id doesn't filter completed_at,
--          so it reads all rows (including NULL) per lesson.
-- Fix: partial index on (lesson_id, user_id) — smaller, only completed rows.
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_completed
    ON lesson_progress(lesson_id, user_id)
    WHERE completed_at IS NOT NULL;


-- Used by: vw_student_course_progress, vw_student_section_progress, vw_student_overview
-- Pattern: GROUP BY user_id, [course/section] after filtering completed_at IS NOT NULL
-- Problem: existing idx_lesson_progress_completed is (user_id, completed_at) —
--          doesn't include lesson_id, forcing a heap fetch per row to get lesson_id.
-- Fix: covering index with INCLUDE so the planner can do index-only scans.
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_completed_covering
    ON lesson_progress(user_id, completed_at)
    INCLUDE (lesson_id)
    WHERE completed_at IS NOT NULL;


-- ============================================================================
-- memberships indexes
-- ============================================================================

-- Used by: ALL subscription views (vw_subscription_summary, vw_subscription_engagement,
--          vw_weekly_active_students_by_subscription, vw_at_risk_students, etc.)
-- Pattern: JOIN memberships m ON m.user_id = lp.user_id AND m.status = 'active'
-- Problem: existing idx_memberships_level_status is (membership_level_id, status) —
--          useless when the join arrives from user_id side. The planner falls back
--          to idx_memberships_user_id and then filters status in memory.
-- Fix: partial index on active subscriptions only, ordered by user_id.
--      This is much smaller than a full index (excludes expired/inactive/pending).
CREATE INDEX IF NOT EXISTS idx_memberships_active_user
    ON memberships(user_id, membership_level_id)
    WHERE status = 'active';


-- ============================================================================
-- sections covering index
-- ============================================================================

-- Used by: vw_student_course_progress, vw_student_section_progress, vw_learning_velocity,
--          vw_at_risk_students, vw_subscription_course_completion
-- Pattern: JOIN sections s ON s.id = l.section_id  → then use s.course_id
-- Problem: PK index on sections(id) exists but doesn't include course_id,
--          so PostgreSQL must hit the heap for every section row to read course_id.
-- Fix: covering index — index-only scan returns course_id without heap access.
CREATE INDEX IF NOT EXISTS idx_sections_id_cover_course
    ON sections(id)
    INCLUDE (course_id, name, position);


-- ============================================================================
-- lessons covering index
-- ============================================================================

-- Used by: vw_student_course_progress, vw_course_funnel and others
-- Pattern: JOIN lessons l ON l.id = lp.lesson_id  → then use l.section_id
-- Same pattern as sections above: PK exists but doesn't cover section_id.
CREATE INDEX IF NOT EXISTS idx_lessons_id_cover_section
    ON lessons(id)
    INCLUDE (section_id, title, position);


-- ============================================================================
-- users index for inactive queries
-- ============================================================================

-- Used by: vw_inactive_students, vw_at_risk_students
-- Pattern: WHERE u.last_seen_at < NOW() - INTERVAL '7 days' AND u.blocked = FALSE
-- Problem: no index on last_seen_at — full table scan on every query.
CREATE INDEX IF NOT EXISTS idx_users_last_seen_active
    ON users(last_seen_at)
    WHERE blocked = FALSE AND last_seen_at IS NOT NULL;
