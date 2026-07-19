-- ============================================================================
-- Migration 052: Add analytics fields to classrooms
--
-- MemberKit's /classrooms endpoint returns master, course_name, users_count,
-- comments_count, and average_progress, but the sync pipeline previously
-- only captured mk_id, name, and created_at. These fields carry tracking
-- value (not visual/content-only), so they're added here.
-- ============================================================================

ALTER TABLE classrooms
    ADD COLUMN master            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN course_name       TEXT,
    ADD COLUMN users_count       INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN comments_count    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN average_progress  NUMERIC NOT NULL DEFAULT 0;
