-- ============================================================================
-- Migration 030: Covering indexes for vw_lesson_stats / vw_lesson_stats_enhanced
--
-- Context:
--   vw_lesson_stats does COUNT(DISTINCT lr.user_id) and COUNT(DISTINCT co.id)
--   after joining lesson_ratings and comments by lesson_id. The existing indexes
--   on lesson_id don't include user_id / id, forcing a heap fetch per row.
--   With many ratings and comments this causes timeouts in Power BI imports.
--
--   Additionally, force fresh planner statistics after all new indexes (029 + 030).
-- ============================================================================


-- COUNT(DISTINCT lr.user_id) per lesson in vw_lesson_stats / vw_lesson_stats_enhanced
-- Index covers (lesson_id → user_id) so PostgreSQL can do an index-only scan
-- without touching the heap at all.
CREATE INDEX IF NOT EXISTS idx_lesson_ratings_lesson_user
    ON lesson_ratings(lesson_id, user_id)
    INCLUDE (stars);   -- INCLUDE stars for AVG(lr.stars) also index-only


-- COUNT(DISTINCT co.id) per lesson in vw_lesson_stats
-- Existing idx_comments_lesson_id only has lesson_id; adding id makes it covering.
CREATE INDEX IF NOT EXISTS idx_comments_lesson_id_cover
    ON comments(lesson_id)
    INCLUDE (id);


-- Refresh planner statistics so PostgreSQL knows to use all new indexes
-- (runs fast — just samples the tables)
ANALYZE lesson_progress;
ANALYZE lesson_ratings;
ANALYZE comments;
ANALYZE lessons;
ANALYZE sections;
ANALYZE memberships;
ANALYZE users;
