-- Migration 048: Rebuild mvw_expiring_subscriptions with activity and evaluation dates
--
-- Adds last_activity_date (last lesson completed) and ultima_avaliacao (last quiz/rating)
-- so the dashboard can separate "recuperáveis" (active in last 30 days) from cold leads.

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
  u.phone               AS telefone,
  (
    SELECT MAX(lp.occurred_at)
    FROM lesson_progress lp
    WHERE lp.user_id = u.id
  ) AS last_activity_date,
  GREATEST(
    (SELECT MAX(lr.created_at) FROM lesson_ratings lr WHERE lr.user_id = u.id),
    (SELECT MAX(qa.created_at) FROM quiz_attempts  qa WHERE qa.user_id = u.id)
  ) AS ultima_avaliacao
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

-- Índice de filtro por data de expiração
CREATE INDEX mvw_expiring_subscriptions_expire
    ON mvw_expiring_subscriptions (expire_date);

-- Índice de filtro por atividade (para separar recuperáveis)
CREATE INDEX mvw_expiring_subscriptions_activity
    ON mvw_expiring_subscriptions (last_activity_date);
