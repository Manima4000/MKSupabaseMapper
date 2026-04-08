-- ============================================================================
-- Migration 013: Weekly engagement views
-- Insights sobre alunos ativos e aulas concluídas por semana
-- ============================================================================

-- ============================================================================
-- VIEW: Aulas concluídas por semana
-- Conta eventos de conclusão distintos (user, lesson) por semana ISO (seg–dom)
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
-- VIEW: Alunos que concluíram ao menos uma aula por semana (total geral)
-- Um aluno é contado apenas uma vez por semana, independente de quantas aulas
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
-- VIEW: Alunos ativos por semana, detalhado por assinatura
-- Considera a assinatura ativa do aluno no momento da consulta (não histórico)
-- Um aluno com múltiplas assinaturas ativas aparece em cada uma delas
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
