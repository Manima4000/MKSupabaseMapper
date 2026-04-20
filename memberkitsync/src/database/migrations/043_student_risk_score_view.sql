-- Migration 043: Create mvw_student_risk_score
--
-- This view provides a personalized risk score for each student based on 
-- their learning velocity and days since last lesson completion.
-- This data powers the new student risk dashboard.

-- 1. Create the new view vw_student_risk_score
CREATE OR REPLACE VIEW vw_student_risk_score AS
WITH student_base AS (
    SELECT
        u.id AS user_id,
        u.full_name,
        u.email,
        u.phone,
        u.last_seen_at,
        (
            SELECT string_agg(DISTINCT ml.name, ', ')
            FROM memberships m
            JOIN membership_levels ml ON ml.id = m.membership_level_id
            WHERE m.user_id = u.id AND m.status = 'active'
        ) AS planos_ativos,
        -- Última aula concluída
        MAX(lp.completed_at) AS last_lesson_completed_at,
        
        -- Aulas concluídas nas últimas 4 semanas (28 dias)
        COUNT(lp.lesson_id) FILTER (WHERE lp.completed_at >= NOW() - INTERVAL '28 days') AS lessons_last_4_weeks,
        
        -- Aulas concluídas na semana atual (7 dias)
        COUNT(lp.lesson_id) FILTER (WHERE lp.completed_at >= NOW() - INTERVAL '7 days') AS lessons_current_week
        
    FROM users u
    LEFT JOIN lesson_progress lp ON lp.user_id = u.id AND lp.completed_at IS NOT NULL
    WHERE u.blocked = FALSE
      -- Somente alunos com alguma assinatura ativa
      AND EXISTS (
          SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.status = 'active'
      )
    GROUP BY u.id, u.full_name, u.email, u.phone, u.last_seen_at
)
SELECT
    user_id,
    full_name AS nome,
    email,
    phone AS telefone,
    planos_ativos,
    last_lesson_completed_at,
    -- Dias sem concluir aula (stuck time)
    EXTRACT(DAY FROM (NOW() - last_lesson_completed_at))::INTEGER AS dias_sem_concluir_aula,
    
    -- Ritmo (Velocity): Quantas aulas por semana ele fazia em média nas últimas 4 semanas vs esta semana
    ROUND((lessons_last_4_weeks::NUMERIC / 4.0), 1) AS media_aulas_por_semana,
    lessons_current_week AS aulas_semana_atual,
    
    -- Risco
    CASE
        WHEN last_lesson_completed_at IS NULL THEN 'Crítico'
        WHEN EXTRACT(DAY FROM (NOW() - last_lesson_completed_at)) >= 21 THEN 'Crítico'
        WHEN EXTRACT(DAY FROM (NOW() - last_lesson_completed_at)) >= 14 THEN 'Alto'
        WHEN EXTRACT(DAY FROM (NOW() - last_lesson_completed_at)) >= 7 THEN 'Médio'
        ELSE 'Baixo'
    END AS risk_level
FROM student_base;

-- 2. Create the materialized view
DROP MATERIALIZED VIEW IF EXISTS mvw_student_risk_score CASCADE;
CREATE MATERIALIZED VIEW mvw_student_risk_score AS
SELECT * FROM vw_student_risk_score;

CREATE UNIQUE INDEX mvw_student_risk_score_user_id ON mvw_student_risk_score (user_id);
CREATE INDEX mvw_student_risk_score_risk_level ON mvw_student_risk_score (risk_level);

-- 3. Atualizar o agendamento de Refresh (pg_cron)
-- Inclui a nova view e altera para refresh de hora em hora
DO $$
BEGIN
    PERFORM cron.unschedule('refresh-dashboard-views');
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

SELECT cron.schedule(
  'refresh-dashboard-views',
  '0 * * * *',
  $job$
  DO $do$
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_weekly_global_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_yearly_weekly_comparison;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_active_students_flat;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_risk_distribution;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_weekly_trend_normalized;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_engagement;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_student_risk_score;
  END $do$;
  $job$
);
