-- ============================================================================
-- Migration 018: Drop UNIQUE constraint from lesson_videos.mk_id
--
-- Problem:
--   upsertLessonVideo conflicts on lesson_id, but when the lesson is new
--   (no video row yet) it falls through to a plain INSERT. If another lesson
--   already has a row with the same mk_id (MemberKit reuses video IDs across
--   lessons), the INSERT fails with:
--     "duplicate key value violates unique constraint lesson_videos_mk_id_key"
--
-- Root cause:
--   lesson_videos.mk_id was assumed to be globally unique, but MemberKit
--   can assign the same video ID to multiple lessons.
--
-- Fix:
--   The true unique key for lesson_videos is lesson_id (1:1 with lessons).
--   mk_id is kept as a regular column for reference but not enforced unique.
-- ============================================================================

ALTER TABLE lesson_videos DROP CONSTRAINT IF EXISTS lesson_videos_mk_id_key;
