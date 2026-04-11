-- ============================================================================
-- Migration 019: Backfill lesson_ratings from user_activities
--
-- Context:
--   Migration 017 incorrectly assumed that Rating events in user_activities
--   had already been synced to lesson_ratings ("no change needed").
--   In practice, only ~8k rows came in via rating.saved webhooks while
--   ~527k Rating events remained in user_activities without a corresponding row.
--
--   Source shape in user_activities for event_type = 'Rating':
--     user_id      → FK to users (already resolved)
--     mk_lesson_id → MK lesson id → join to lessons.mk_id to get lesson.id
--     trackable    → { "id": <mk_rating_id>, "stars": <1-5>,
--                      "created_at": "...", "updated_at": "..." }
--
--   Conflict strategy:
--     • If a row with the same mk_id already exists (came in via webhook)
--       → DO NOTHING (webhook data takes precedence).
--     • If a row with the same (user_id, lesson_id) already exists but a
--       different mk_id → DO NOTHING (keep existing webhook row).
--     • Among duplicate Rating rows for the same (user_id, lesson_id) in
--       user_activities → keep the one with the latest created_at (DISTINCT ON).
-- ============================================================================

INSERT INTO lesson_ratings (mk_id, user_id, lesson_id, stars, created_at)
SELECT DISTINCT ON (ua.user_id, l.id)
    (ua.trackable->>'id')::INTEGER              AS mk_id,
    ua.user_id,
    l.id                                        AS lesson_id,
    (ua.trackable->>'stars')::SMALLINT          AS stars,
    (ua.trackable->>'created_at')::TIMESTAMPTZ  AS created_at
FROM user_activities ua
JOIN lessons l ON l.mk_id = ua.mk_lesson_id
WHERE ua.event_type    = 'Rating'
  AND ua.mk_lesson_id  IS NOT NULL
  AND ua.trackable->>'id'    IS NOT NULL
  AND ua.trackable->>'stars' IS NOT NULL
  -- Skip ratings whose mk_id already exists (came in via rating.saved webhook)
  AND NOT EXISTS (
      SELECT 1
      FROM lesson_ratings lr
      WHERE lr.mk_id = (ua.trackable->>'id')::INTEGER
  )
ORDER BY ua.user_id, l.id, (ua.trackable->>'created_at')::TIMESTAMPTZ DESC
ON CONFLICT (user_id, lesson_id) DO NOTHING;
