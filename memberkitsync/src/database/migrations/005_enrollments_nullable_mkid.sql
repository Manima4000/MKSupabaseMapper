-- Migration 005: Adapt enrollments table for MemberKit API reality
--
-- The MemberKit API has no standalone /enrollments endpoint.
-- Enrollments are returned inline inside GET /users/{id} and have no enrollment ID.
-- Only webhook payloads (enrollment.created / enrollment.updated) carry an mk_id.
--
-- Changes:
--   1. Make mk_id nullable so sync-path upserts (no ID available) can omit it.
--   2. Add UNIQUE (user_id, course_id) so the sync path can upsert by this pair.

ALTER TABLE enrollments
  ALTER COLUMN mk_id DROP NOT NULL;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_user_course_unique UNIQUE (user_id, course_id);
