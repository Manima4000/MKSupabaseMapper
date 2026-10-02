-- ============================================================================
-- Migration 058: View de Histórico de Assinaturas Ativas por Mês
-- Contexto: Criação de view para exibir a quantidade histórica de assinaturas
--           ativas em cada mês. Uma assinatura é considerada ativa em um mês
--           se ela foi criada antes do fim daquele mês e (continua ativa hoje 
--           OU expirou apenas durante ou depois desse mês).
-- ============================================================================

CREATE OR REPLACE VIEW vw_historical_active_subscriptions AS
WITH months AS (
    SELECT generate_series(
        '2026-04-01'::date,
        DATE_TRUNC('month', CURRENT_DATE)::date,
        '1 month'::interval
    )::date AS month_start
)
SELECT 
    mo.month_start,
    ml.id AS membership_level_id,
    ml.name AS level_name,
    COUNT(m.id) AS active_subscriptions
FROM months mo
CROSS JOIN membership_levels ml
LEFT JOIN memberships m 
    ON m.membership_level_id = ml.id
    AND m.status IN ('active', 'expired')
    AND m.created_at < mo.month_start + INTERVAL '1 month'
    AND (
        m.status = 'active' 
        OR (m.status = 'expired' AND COALESCE(m.expire_date, m.updated_at) >= mo.month_start)
    )
GROUP BY mo.month_start, ml.id, ml.name
ORDER BY mo.month_start DESC, ml.name;

-- Criação da Materialized View
DROP MATERIALIZED VIEW IF EXISTS mvw_historical_active_subscriptions CASCADE;

CREATE MATERIALIZED VIEW mvw_historical_active_subscriptions AS
    SELECT * FROM vw_historical_active_subscriptions;

-- Índice UNIQUE necessário para permitir REFRESH CONCURRENTLY
CREATE UNIQUE INDEX mvw_historical_active_subscriptions_pk 
    ON mvw_historical_active_subscriptions (membership_level_id, month_start);

-- Adiciona a view ao pg_cron job para atualização (opcional)
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
    REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_historical_active_subscriptions;
  END $do$;
  $job$
);
