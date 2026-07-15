-- ============================================================================
-- Migration 050: Security hardening — corrige achados do Security Advisor
--
-- Contexto:
--   O backend usa apenas a service_role key (bypassa RLS sempre — ver
--   src/config/supabase.ts). Nenhuma parte do código usa a anon key.
--   Ainda assim, o Supabase expõe automaticamente toda tabela/view/matview
--   do schema public via API REST para os papéis anon/authenticated,
--   a menos que o acesso seja revogado explicitamente.
--
--   O Security Advisor encontrou:
--   1) 8 views com propriedade "SECURITY DEFINER" (rodam com os privilégios
--      do owner "postgres", que ignora RLS — logo, RLS das tabelas base
--      NÃO é aplicada quando a view é consultada por anon/authenticated).
--   2) 7 materialized views legíveis por anon/authenticated. Materialized
--      views NUNCA suportam RLS no Postgres — se o SELECT está liberado,
--      o dado sai inteiro, sem filtro nenhum.
--   3) Uma dessas matviews (mvw_expiring_subscriptions) e uma view
--      (vw_active_students_flat / mvw_active_students_flat) devolvem
--      nome, email e telefone de alunos — PII completo exposto publicamente
--      via REST API com a anon key (que é pública por natureza).
--   4) Função rls_auto_enable() é SECURITY DEFINER e está com EXECUTE
--      liberado para anon/authenticated via RPC.
--   5) Funções sem search_path fixo (hardening defensivo contra
--      schema hijacking).
--
--   Nada disso afeta a aplicação: ela só acessa o banco via service_role.
--   Esta migration apenas fecha o acesso público que nunca foi usado.
-- ============================================================================

-- ============================================================================
-- 1. Views: força security_invoker = on
--    A view passa a rodar com os privilégios/RLS de quem está consultando,
--    e não mais do owner (postgres). Requer Postgres 15+ (Supabase já usa).
-- ============================================================================

ALTER VIEW vw_student_course_progress            SET (security_invoker = on);
ALTER VIEW vw_subscription_risk_distribution      SET (security_invoker = on);
ALTER VIEW vw_subscription_engagement             SET (security_invoker = on);
ALTER VIEW vw_subscription_weekly_trend_normalized SET (security_invoker = on);
ALTER VIEW vw_weekly_global_stats                 SET (security_invoker = on);
ALTER VIEW vw_yearly_weekly_comparison             SET (security_invoker = on);
ALTER VIEW vw_active_students_flat                SET (security_invoker = on);
ALTER VIEW vw_subscription_summary                SET (security_invoker = on);

-- ============================================================================
-- 2. Revoga acesso público (anon/authenticated) das views e materialized
--    views analíticas/administrativas. O service_role continua com acesso
--    total (revoke não afeta service_role, que não está listado abaixo).
-- ============================================================================

REVOKE SELECT ON
    vw_student_course_progress,
    vw_subscription_risk_distribution,
    vw_subscription_engagement,
    vw_subscription_weekly_trend_normalized,
    vw_weekly_global_stats,
    vw_yearly_weekly_comparison,
    vw_active_students_flat,
    vw_subscription_summary,
    mvw_subscription_risk_distribution,
    mvw_subscription_engagement,
    mvw_weekly_global_stats,
    mvw_yearly_weekly_comparison,
    mvw_active_students_flat,
    mvw_subscription_summary,
    mvw_subscription_weekly_trend_normalized,
    mvw_expiring_subscriptions
FROM anon, authenticated;

-- ============================================================================
-- 3. Revoga acesso público das tabelas sensíveis (defesa em profundidade —
--    RLS já bloqueia por falta de policy, mas remover o GRANT de base
--    também limpa o aviso "RLS Enabled No Policy" do advisor).
--    Tabelas de catálogo público (categories, courses, sections, lessons,
--    lesson_videos, membership_levels) NÃO entram aqui — elas têm policy
--    explícita de leitura pública (migration 004) e isso é intencional.
-- ============================================================================

REVOKE SELECT ON
    users,
    memberships,
    enrollments,
    comments,
    quiz_attempts,
    forum_posts,
    forum_comments,
    lesson_file_downloads,
    lesson_progress,
    lesson_ratings,
    webhook_logs,
    membership_snapshots,
    dashboard_templates,
    tmp_csv_b64,
    tmp_reativaveis_run
FROM anon, authenticated;

-- ============================================================================
-- 4. rls_auto_enable(): função SECURITY DEFINER usada apenas pelo event
--    trigger interno (auto-habilita RLS em tabelas novas). Não deveria ser
--    chamável via RPC por ninguém de fora.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 5. Fixa search_path nas funções apontadas pelo advisor
--    (mitigação contra schema hijacking via search_path mutável).
-- ============================================================================

ALTER FUNCTION fn_student_full_progress(bigint)   SET search_path = public, pg_temp;
ALTER FUNCTION fn_resolve_mk_id(text, integer)    SET search_path = public, pg_temp;
ALTER FUNCTION fn_active_students_count(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION run_membership_snapshot()          SET search_path = public, pg_temp;
ALTER FUNCTION fn_new_enrollments_summary(date, date) SET search_path = public, pg_temp;
ALTER FUNCTION trigger_set_updated_at()           SET search_path = public, pg_temp;

-- ============================================================================
-- Verificação após aplicar:
--   1. Rode novamente o Security Advisor no dashboard do Supabase —
--      os erros "Security Definer View" e os warnings "Materialized View
--      in API" devem desaparecer.
--   2. Teste o dashboard/API da aplicação normalmente — ela usa
--      service_role e não é afetada por nenhuma das mudanças acima.
--   3. (Opcional/fora desta migration) considerar dropar tmp_csv_b64 e
--      tmp_reativaveis_run se forem sobras de um script pontual — ambas
--      guardam PII de alunos (nome/email/telefone) e não fazem parte do
--      fluxo documentado no CLAUDE.md.
-- ============================================================================
