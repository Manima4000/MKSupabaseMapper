-- Migration 045: Materialized View para Assinaturas Prestes a Expirar
--
-- Estratégia: pre-join de memberships + users + membership_levels em uma mvw.
-- O filtro de datas (próximos 30 dias) é aplicado em query-time sobre a mvw,
-- o que é rápido graças ao índice em expire_date.
--
-- Por que mvw e não função: a função percorre as tabelas base com JOIN a cada
-- requisição. A mvw guarda o resultado pré-computado e serve o dado em <5ms.
-- O dado é refrascado a cada hora pelo pg_cron — aceitável para uma lista
-- de contato de renovação.

-- Drop das funções caso existam (idempotente)
DROP FUNCTION IF EXISTS fn_expiring_subscriptions_summary();
DROP FUNCTION IF EXISTS fn_students_expiring_soon();

-- ─── mvw_expiring_subscriptions ──────────────────────────────────────────────
-- Contém TODAS as assinaturas ativas com expire_date no futuro.
-- O filtro de janela (30d, 14d, 7d) é aplicado pelo repositório em query-time.

DROP MATERIALIZED VIEW IF EXISTS mvw_expiring_subscriptions CASCADE;

CREATE MATERIALIZED VIEW mvw_expiring_subscriptions AS
SELECT
  m.id                  AS membership_id,
  m.expire_date,
  m.membership_level_id,
  ml.name               AS level_name,
  u.id                  AS user_id,
  u.full_name           AS nome,
  u.email,
  u.phone               AS telefone
FROM memberships m
JOIN membership_levels ml ON ml.id = m.membership_level_id
JOIN users         u      ON u.id  = m.user_id
WHERE m.status      = 'active'
  AND m.expire_date IS NOT NULL
  AND m.expire_date >= NOW()
ORDER BY m.expire_date ASC;

-- Índice único obrigatório para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX mvw_expiring_subscriptions_pk
    ON mvw_expiring_subscriptions (membership_id);

-- Índice de busca para filtro de data (a query central desta feature)
CREATE INDEX mvw_expiring_subscriptions_expire
    ON mvw_expiring_subscriptions (expire_date);

-- ─── pg_cron: adicionar ao job horário existente ──────────────────────────────
-- Atualiza o agendamento para incluir a nova mvw.
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
  END $do$;
  $job$
);
