-- migration 034: padroniza nomes de coluna em vw_subscription_weekly_trend_normalized
-- Problema: a view usava `subscription_name` enquanto vw_subscription_engagement e
-- vw_subscription_risk_distribution usam `level_name` + `membership_level_id`.
-- Isso impedia criar relacionamentos no Power BI e causava cross-filter com datas aleatórias.
-- Fix: renomear alias para `level_name` e adicionar `membership_level_id`.

DROP VIEW IF EXISTS vw_subscription_weekly_trend_normalized;

CREATE VIEW vw_subscription_weekly_trend_normalized AS
SELECT
    date_trunc('week', lp.completed_at)::date AS week_start,
    ml.id                                      AS membership_level_id,
    ml.name                                    AS level_name,
    COUNT(DISTINCT lp.user_id)                 AS active_students,
    COUNT(*)                                   AS lessons_completed,
    ROUND(COALESCE(SUM(lv.duration_seconds), 0)::numeric / 3600.0, 2) AS estimated_hours,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT lp.user_id), 0)::numeric, 1) AS lessons_per_student,
    ROUND(COALESCE(SUM(lv.duration_seconds), 0)::numeric / 3600.0
          / NULLIF(COUNT(DISTINCT lp.user_id), 0)::numeric, 2)          AS hours_per_student
FROM lesson_progress lp
LEFT JOIN lesson_videos lv ON lv.lesson_id = lp.lesson_id
JOIN memberships m
    ON m.user_id = lp.user_id
   AND m.status = 'active'
JOIN membership_levels ml ON ml.id = m.membership_level_id
WHERE lp.completed_at IS NOT NULL
GROUP BY date_trunc('week', lp.completed_at), ml.id, ml.name
ORDER BY week_start DESC, ml.name;
