-- Migration 007: Replace payload JSONB with explicit columns in user_activities
-- Run this in the Supabase SQL Editor before deploying the updated code.

ALTER TABLE user_activities
  ADD COLUMN mk_course_id INTEGER,
  ADD COLUMN mk_lesson_id INTEGER,
  ADD COLUMN trackable     JSONB;

-- Migrate existing data from payload to new columns
UPDATE user_activities
SET
  mk_course_id = (payload->>'course_id')::INTEGER,
  mk_lesson_id = (payload->>'lesson_id')::INTEGER,
  trackable    = payload->'trackable'
WHERE payload IS NOT NULL AND payload != '{}';

ALTER TABLE user_activities DROP COLUMN payload;

-- Indexes for common query patterns
CREATE INDEX idx_user_activities_mk_course_id ON user_activities (mk_course_id);
CREATE INDEX idx_user_activities_mk_lesson_id ON user_activities (mk_lesson_id);
