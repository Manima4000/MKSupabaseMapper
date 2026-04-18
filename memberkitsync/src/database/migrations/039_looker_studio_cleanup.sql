-- 039_looker_studio_cleanup.sql
-- Removes views and indexes unused after migrating from PowerBI to Looker Studio.
--
-- VIEWS KEPT:
--   Visão Geral : vw_weekly_global_stats, vw_yearly_weekly_comparison, vw_active_students_flat
--   Assinaturas : vw_subscription_summary, vw_subscription_engagement,
--                 vw_subscription_weekly_trend_normalized, vw_subscription_risk_distribution
--   API         : vw_student_course_progress, vw_inactive_students

-- ─── Drop unused views ────────────────────────────────────────────────────────

-- Churn/risk analysis view — not used in any dashboard or API endpoint
DROP VIEW IF EXISTS vw_at_risk_students;

-- Funnel analytics — not used in any dashboard or API endpoint
DROP VIEW IF EXISTS vw_course_funnel;

-- Trivial wrapper over lesson_progress table — no view depends on it
DROP VIEW IF EXISTS vw_lesson_progress;

-- Lesson-level rating histogram — not used in any dashboard
DROP VIEW IF EXISTS vw_lesson_ratings_summary;

-- Basic lesson stats — superseded by vw_lesson_stats_enhanced (also dropped below)
DROP VIEW IF EXISTS vw_lesson_stats;

-- Enhanced lesson stats — not used in any dashboard
DROP VIEW IF EXISTS vw_lesson_stats_enhanced;

-- Full student profile view — not used in any dashboard or API endpoint
DROP VIEW IF EXISTS vw_student_overview;

-- Per-student weekly engagement — was loaded in PowerBI but never bound to any chart
DROP VIEW IF EXISTS vw_student_weekly_activity;

-- ─── Drop redundant indexes ───────────────────────────────────────────────────

-- Exact duplicate of idx_lesson_progress_completed_at (same definition)
DROP INDEX IF EXISTS idx_lesson_progress_completed_at_only;

-- Fully superseded by idx_comments_lesson_id_cover (lesson_id INCLUDE id)
DROP INDEX IF EXISTS idx_comments_lesson_id;

-- ─── Verify ───────────────────────────────────────────────────────────────────

-- Run after applying to confirm remaining views:
-- SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;
--
-- Expected (9 views):
--   vw_active_students_flat
--   vw_inactive_students
--   vw_student_course_progress
--   vw_subscription_engagement
--   vw_subscription_risk_distribution
--   vw_subscription_summary
--   vw_subscription_weekly_trend_normalized
--   vw_weekly_global_stats
--   vw_yearly_weekly_comparison
