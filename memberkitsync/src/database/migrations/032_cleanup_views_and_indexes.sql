-- ============================================================================
-- Migration 032: Drop unused views + add indexes for new views (031)
--
-- Context:
--   After the Power BI redesign (031), several views are no longer used by
--   any Power BI page or API endpoint. Dropping them reduces planning overhead
--   and removes dead catalog entries.
--
--   New indexes target the 3 views added in 031.
--
-- Views KEPT (not dropped here):
--   vw_lesson_progress              — base view, used by other views
--   vw_student_course_progress      — used by API + internal dependency of subscription views
--   vw_student_overview             — used by API GET /api/users
--   vw_inactive_students            — used by API GET /api/users/inactive
--   vw_weekly_active_students       — Power BI: Visão Geral gráfico 4.4
--   vw_student_weekly_activity      — Power BI: Visão Geral KPIs + gráfico 4.3
--   vw_subscription_summary         — Power BI: Assinaturas KPIs
--   vw_subscription_engagement      — Power BI: Assinaturas KPIs + tabela
--   vw_lesson_stats                 — content analytics (keep for future use)
--   vw_lesson_stats_enhanced        — content analytics (keep for future use)
--   vw_course_funnel                — content analytics (keep for future use)
--   vw_lesson_ratings_summary       — content analytics (keep for future use)
--   vw_at_risk_students             — keep (dropped in 026 anyway, no-op)
--   All views added in 031          — new views
-- ============================================================================


-- ============================================================================
-- 1. Drop views no longer used by Power BI or API
-- ============================================================================

-- Replaced by vw_subscription_weekly_trend_normalized (031)
DROP VIEW IF EXISTS vw_subscription_weekly_trend CASCADE;

-- Not used in any Power BI page or API endpoint
DROP VIEW IF EXISTS vw_subscription_course_completion CASCADE;
DROP VIEW IF EXISTS vw_learning_velocity CASCADE;
DROP VIEW IF EXISTS vw_student_section_progress CASCADE;
DROP VIEW IF EXISTS vw_weekly_study_hours CASCADE;
DROP VIEW IF EXISTS vw_weekly_study_hours_by_subscription CASCADE;
DROP VIEW IF EXISTS vw_weekly_lessons_completed CASCADE;
DROP VIEW IF EXISTS vw_weekly_active_students_by_subscription CASCADE;


-- ============================================================================
-- 2. lesson_videos — index for JOIN lesson_videos lv ON lv.lesson_id = lp.lesson_id
--
-- Used by: vw_yearly_weekly_comparison, vw_subscription_weekly_trend_normalized,
--          vw_subscription_engagement, vw_subscription_risk_distribution,
--          vw_student_weekly_activity, vw_lesson_stats_enhanced
-- No index existed in migration 002 (lesson_files has one; lesson_videos did not).
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lesson_videos_lesson_id
    ON lesson_videos(lesson_id)
    INCLUDE (duration_seconds);


-- ============================================================================
-- 3. lesson_progress — partial index for 2025+ rows (vw_yearly_weekly_comparison)
--
-- The view filters: WHERE completed_at IS NOT NULL AND EXTRACT(ISOYEAR ...) >= 2025
-- The year-function predicate can't be pushed into a standard B-tree scan, but a
-- partial index on completed_at >= '2025-01-01' lets the planner scan only the
-- relevant date range rather than all historical rows.
-- Covering user_id + lesson_id avoids heap fetches for COUNT(DISTINCT user_id)
-- and the JOIN with lesson_videos.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lesson_progress_2025plus
    ON lesson_progress(completed_at)
    INCLUDE (user_id, lesson_id)
    WHERE completed_at >= '2025-01-01';


-- ============================================================================
-- 4. Refresh planner statistics for affected tables
-- ============================================================================

ANALYZE lesson_progress;
ANALYZE lesson_videos;
