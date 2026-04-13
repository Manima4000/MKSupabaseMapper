-- ============================================================================
-- Migration 021: Drop all views and analytic functions
--
-- Prepares a clean slate for rebuilding all views from scratch.
-- Trigger functions (trigger_set_updated_at) are NOT dropped.
-- ============================================================================

-- Views P0 (created in 019)
DROP VIEW IF EXISTS vw_at_risk_students CASCADE;
DROP VIEW IF EXISTS vw_quiz_performance_by_quiz CASCADE;
DROP VIEW IF EXISTS vw_learning_velocity CASCADE;
DROP VIEW IF EXISTS vw_lesson_stats_enhanced CASCADE;

-- Analytics views (created in 014 / recreated in 019)
DROP VIEW IF EXISTS vw_student_overview CASCADE;
DROP VIEW IF EXISTS vw_lesson_stats CASCADE;
DROP VIEW IF EXISTS vw_course_funnel CASCADE;
DROP VIEW IF EXISTS vw_student_quiz_summary CASCADE;
DROP VIEW IF EXISTS vw_lesson_ratings_summary CASCADE;
DROP VIEW IF EXISTS vw_inactive_students CASCADE;
DROP VIEW IF EXISTS vw_subscription_summary CASCADE;

-- Weekly views (created in 013 / recreated in 017/019)
DROP VIEW IF EXISTS vw_weekly_active_students_by_subscription CASCADE;
DROP VIEW IF EXISTS vw_weekly_active_students CASCADE;
DROP VIEW IF EXISTS vw_weekly_lessons_completed CASCADE;

-- Core progress views (created in 009 / recreated in 017/019)
DROP VIEW IF EXISTS vw_student_section_progress CASCADE;
DROP VIEW IF EXISTS vw_student_course_progress CASCADE;

-- Base view — drop last because others depend on it
DROP VIEW IF EXISTS vw_lesson_progress CASCADE;

-- Analytic functions
DROP FUNCTION IF EXISTS fn_student_full_progress(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS fn_resolve_mk_id(TEXT, INTEGER) CASCADE;
