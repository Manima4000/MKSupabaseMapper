-- ============================================================================
-- Migration 014: Normaliza event_type de 'lesson_status.saved' → 'LessonStatus'
--
-- Contexto: webhooks armazenavam 'lesson_status.saved' como event_type, mas o
-- valor canônico do MK (usado no sync completo via API) é 'LessonStatus'.
-- As views de progresso precisam de um único valor para filtrar corretamente.
-- ============================================================================

-- 1. Corrige registros históricos com o valor incorreto
UPDATE user_activities
SET event_type = 'LessonStatus'
WHERE event_type = 'lesson_status.saved';

-- ============================================================================
-- 2. Recria vw_lesson_progress com o event_type correto
-- ============================================================================

CREATE OR REPLACE VIEW vw_lesson_progress AS
SELECT DISTINCT ON (ua.user_id, l.id)
    ua.user_id,
    l.id                                                AS lesson_id,
    (ua.trackable->>'completed_at')::TIMESTAMPTZ        AS completed_at
FROM user_activities ua
JOIN lessons l ON l.mk_id = ua.mk_lesson_id
WHERE ua.event_type = 'LessonStatus'
  AND ua.mk_lesson_id IS NOT NULL
  AND ua.trackable->>'completed_at' IS NOT NULL
ORDER BY ua.user_id, l.id, ua.occurred_at DESC;

-- ============================================================================
-- 3. Recria vw_weekly_lessons_completed
-- ============================================================================

CREATE OR REPLACE VIEW vw_weekly_lessons_completed AS
SELECT
    DATE_TRUNC('week', ua.occurred_at)::DATE    AS week_start,
    COUNT(DISTINCT (ua.user_id, ua.mk_lesson_id)) AS completed_lessons
FROM user_activities ua
WHERE ua.event_type      = 'LessonStatus'
  AND ua.mk_lesson_id   IS NOT NULL
  AND ua.trackable->>'completed_at' IS NOT NULL
GROUP BY DATE_TRUNC('week', ua.occurred_at)
ORDER BY week_start DESC;

-- ============================================================================
-- 4. Recria vw_weekly_active_students
-- ============================================================================

CREATE OR REPLACE VIEW vw_weekly_active_students AS
SELECT
    DATE_TRUNC('week', ua.occurred_at)::DATE    AS week_start,
    COUNT(DISTINCT ua.user_id)                   AS active_students
FROM user_activities ua
WHERE ua.event_type      = 'LessonStatus'
  AND ua.mk_lesson_id   IS NOT NULL
  AND ua.trackable->>'completed_at' IS NOT NULL
GROUP BY DATE_TRUNC('week', ua.occurred_at)
ORDER BY week_start DESC;

-- ============================================================================
-- 5. Recria vw_weekly_active_students_by_subscription
-- ============================================================================

CREATE OR REPLACE VIEW vw_weekly_active_students_by_subscription AS
SELECT
    DATE_TRUNC('week', ua.occurred_at)::DATE    AS week_start,
    ml.name                                      AS subscription_name,
    COUNT(DISTINCT ua.user_id)                   AS active_students
FROM user_activities ua
JOIN memberships m
    ON m.user_id = ua.user_id
   AND m.status  = 'active'
JOIN membership_levels ml
    ON ml.id = m.membership_level_id
WHERE ua.event_type      = 'LessonStatus'
  AND ua.mk_lesson_id   IS NOT NULL
  AND ua.trackable->>'completed_at' IS NOT NULL
GROUP BY DATE_TRUNC('week', ua.occurred_at), ml.id, ml.name
ORDER BY week_start DESC, subscription_name;
