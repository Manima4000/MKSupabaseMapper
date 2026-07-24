-- ============================================================================
-- Migration 053: Add course_id to classrooms
--
-- classrooms.course_name (added in 052) is free text from MemberKit with no
-- formal link to the courses table. This resolves that link: course_id is
-- populated during sync by matching course_name against courses.name. When
-- no match is found, course_id stays NULL (no course exists yet, or the
-- names diverge) — the sync does not fail or log a warning for this case.
-- ============================================================================

ALTER TABLE classrooms
    ADD COLUMN course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL;

CREATE INDEX idx_classrooms_course_id ON classrooms(course_id);
