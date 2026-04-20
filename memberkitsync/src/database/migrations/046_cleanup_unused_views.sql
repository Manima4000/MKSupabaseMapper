-- Migration 046: Remoção de views não utilizadas pelo app
--
-- Views removidas:
--   vw_inactive_students      — não referenciada pelo analytics.repository.ts
--   vw_student_course_progress — não referenciada pelo analytics.repository.ts
--   mvw_student_risk_score    — não mais utilizada após remoção do StudentRiskTable
--   vw_student_risk_score     — base da mvw acima, também removida

DROP VIEW        IF EXISTS vw_inactive_students       CASCADE;
-- NOTA: vw_student_course_progress NÃO é dropada aqui — ela é base para
--       vw_subscription_risk_distribution e vw_subscription_engagement.
--       Dropá-la com CASCADE destrói as MVWs de assinatura. Ver migration 039.
DROP MATERIALIZED VIEW IF EXISTS mvw_student_risk_score CASCADE;
DROP VIEW        IF EXISTS vw_student_risk_score      CASCADE;

-- Atualizar pg_cron para remover refresh da mvw_student_risk_score
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
