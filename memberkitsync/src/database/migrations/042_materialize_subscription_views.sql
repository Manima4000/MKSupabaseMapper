-- 1. Criar as Views Materializadas para Assinaturas
-- Estas views pré-processam os cálculos pesados de risco e progresso
-- Baixa o tempo de resposta de ~12s para <50ms

CREATE MATERIALIZED VIEW IF NOT EXISTS mvw_subscription_risk_distribution AS
  SELECT * FROM vw_subscription_risk_distribution;

CREATE MATERIALIZED VIEW IF NOT EXISTS mvw_subscription_weekly_trend_normalized AS
  SELECT * FROM vw_subscription_weekly_trend_normalized;

CREATE MATERIALIZED VIEW IF NOT EXISTS mvw_subscription_engagement AS
  SELECT * FROM vw_subscription_engagement;

-- 2. Adicionar Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_mvw_sub_risk_level ON mvw_subscription_risk_distribution (membership_level_id);
CREATE INDEX IF NOT EXISTS idx_mvw_sub_trend_week ON mvw_subscription_weekly_trend_normalized (week_start);
CREATE INDEX IF NOT EXISTS idx_mvw_sub_eng_level ON mvw_subscription_engagement (membership_level_id);

-- 3. Atualizar o agendamento de Refresh (pg_cron)
-- Usamos um bloco DO para tentar remover o agendamento sem falhar se ele não existir
DO $$
BEGIN
    PERFORM cron.unschedule('refresh-dashboard-views');
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

SELECT cron.schedule(
  'refresh-dashboard-views',
  '0 0 * * *',
  $job$
  DO $do$
  BEGIN
    REFRESH MATERIALIZED VIEW mvw_weekly_global_stats;
    REFRESH MATERIALIZED VIEW mvw_yearly_weekly_comparison;
    REFRESH MATERIALIZED VIEW mvw_active_students_flat;
    REFRESH MATERIALIZED VIEW mvw_subscription_summary;
    REFRESH MATERIALIZED VIEW mvw_subscription_risk_distribution;
    REFRESH MATERIALIZED VIEW mvw_subscription_weekly_trend_normalized;
    REFRESH MATERIALIZED VIEW mvw_subscription_engagement;
  END $do$;
  $job$
);

