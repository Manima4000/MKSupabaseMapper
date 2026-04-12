-- ============================================================================
-- Migration 021: Remove UNIQUE constraint from lesson_progress.mk_id
--
-- Context:
--   MemberKit reuses the same id value across different lessons in the
--   lesson_status.saved webhook payload. This means mk_id is NOT globally
--   unique in lesson_progress — the real business key is (user_id, lesson_id).
--
--   Fix: drop the unique constraint, keep a plain index for lookups.
-- ============================================================================

ALTER TABLE lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_mk_id_key;

CREATE INDEX IF NOT EXISTS idx_lesson_progress_mk_id ON lesson_progress(mk_id);
