-- ============================================================================
-- Migration 057: Assinaturas Ativas por Mês por Assinatura
-- Contexto: Criação de view para exibir a quantidade de assinaturas 
--           ativas agrupadas por mês de criação e por plano (assinatura).
-- ============================================================================

CREATE OR REPLACE VIEW vw_active_subscriptions_by_month AS
SELECT 
    DATE_TRUNC('month', m.created_at)::DATE AS month_start,
    ml.id AS membership_level_id,
    ml.name AS level_name,
    COUNT(m.id) AS active_subscriptions
FROM memberships m
JOIN membership_levels ml ON ml.id = m.membership_level_id
WHERE m.status = 'active' AND m.created_at >= '2026-04-01'
GROUP BY DATE_TRUNC('month', m.created_at)::DATE, ml.id, ml.name
ORDER BY month_start DESC, ml.name;

-- Criação da Materialized View
DROP MATERIALIZED VIEW IF EXISTS mvw_active_subscriptions_by_month CASCADE;

CREATE MATERIALIZED VIEW mvw_active_subscriptions_by_month AS
    SELECT * FROM vw_active_subscriptions_by_month;

-- Índice UNIQUE necessário para permitir REFRESH CONCURRENTLY
CREATE UNIQUE INDEX mvw_active_subscriptions_by_month_pk 
    ON mvw_active_subscriptions_by_month (membership_level_id, month_start);

-- Adiciona a view ao pg_cron job para atualização (opcional, atualiza a schedule)
DO $$
BEGIN
    PERFORM cron.unschedule('refresh-dashboard-views');
EXCEPTION
    WHEN OTHERS THEN NULL;
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
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_expiring_subscriptions;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_active_subscriptions_by_month;
  END $do$;
  $job$
);
