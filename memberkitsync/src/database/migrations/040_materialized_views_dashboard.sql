-- ============================================================================
-- Migration 040: Materialized Views para o Dashboard
--
-- Contexto:
--   As views regulares (vw_weekly_global_stats, etc.) recomputam todo o
--   agregado de lesson_progress a cada query. Em um dashboard com múltiplos
--   usuários e múltiplos cards, isso gera carga desnecessária.
--
--   Views materializadas guardam o resultado pré-computado fisicamente.
--   Cada query de dashboard passa de ~200-500ms para <10ms.
--   O refresh automático via pg_cron garante que os dados nunca fiquem
--   desatualizados por mais de 1 hora.
--
-- Views criadas (prefixo mvw_):
--   mvw_weekly_global_stats        → KPIs semanais (bar + area chart)
--   mvw_yearly_weekly_comparison   → comparação ano-a-ano (line chart)
--   mvw_active_students_flat       → contagem correta de alunos únicos no período
--   mvw_subscription_summary       → resumo por plano de assinatura
--
-- Índices:
--   - Índice UNIQUE em cada view (obrigatório para REFRESH CONCURRENTLY)
--   - Índices de busca por week_start (filtro de data no dashboard)
--
-- pg_cron:
--   Job agendado para refresh a cada hora (minuto 0 de cada hora).
--   CONCURRENTLY não bloqueia leituras durante o refresh.
-- ============================================================================


-- ─── 1. mvw_weekly_global_stats ──────────────────────────────────────────────

CREATE MATERIALIZED VIEW mvw_weekly_global_stats AS
  SELECT * FROM vw_weekly_global_stats;

-- Único por semana
CREATE UNIQUE INDEX mvw_weekly_global_stats_week_start
    ON mvw_weekly_global_stats (week_start);

-- Índice para filtro de data (queries com WHERE week_start BETWEEN ...)
CREATE INDEX mvw_weekly_global_stats_week_start_brin
    ON mvw_weekly_global_stats USING brin (week_start);


-- ─── 2. mvw_yearly_weekly_comparison ─────────────────────────────────────────

CREATE MATERIALIZED VIEW mvw_yearly_weekly_comparison AS
  SELECT * FROM vw_yearly_weekly_comparison;

-- Único por (ano, semana ISO)
CREATE UNIQUE INDEX mvw_yearly_weekly_comparison_year_week
    ON mvw_yearly_weekly_comparison (year, iso_week);


-- ─── 3. mvw_active_students_flat ─────────────────────────────────────────────

CREATE MATERIALIZED VIEW mvw_active_students_flat AS
  SELECT * FROM vw_active_students_flat;

-- Único por (aluno, semana)
CREATE UNIQUE INDEX mvw_active_students_flat_user_week
    ON mvw_active_students_flat (user_id, week_start);

-- Índice para filtro de data (conta alunos únicos em período filtrado)
CREATE INDEX mvw_active_students_flat_week_start
    ON mvw_active_students_flat (week_start);

-- Índice para DISTINCT user_id em uma passagem por week_start
CREATE INDEX mvw_active_students_flat_user_id
    ON mvw_active_students_flat (user_id);


-- ─── 4. mvw_subscription_summary ─────────────────────────────────────────────

CREATE MATERIALIZED VIEW mvw_subscription_summary AS
  SELECT * FROM vw_subscription_summary;

-- Único por plano
CREATE UNIQUE INDEX mvw_subscription_summary_level_id
    ON mvw_subscription_summary (membership_level_id);


-- ─── 5. Verificação ──────────────────────────────────────────────────────────
--
-- Após aplicar, confirme:
--   SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';
-- Esperado: mvw_active_students_flat, mvw_subscription_summary,
--           mvw_weekly_global_stats, mvw_yearly_weekly_comparison
--
-- ─── Refresh manual (rodar após cada sync) ───────────────────────────────────
--
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_weekly_global_stats;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_yearly_weekly_comparison;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_active_students_flat;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_summary;
--
-- ─── Opcional: pg_cron automático ────────────────────────────────────────────
-- Habilite pg_cron em Database → Extensions no Supabase, depois rode:
--
-- SELECT cron.schedule(
--   'refresh-dashboard-mvws',
--   '0 * * * *',
--   $$
--     REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_weekly_global_stats;
--     REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_yearly_weekly_comparison;
--     REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_active_students_flat;
--     REFRESH MATERIALIZED VIEW CONCURRENTLY mvw_subscription_summary;
--   $$
-- );
