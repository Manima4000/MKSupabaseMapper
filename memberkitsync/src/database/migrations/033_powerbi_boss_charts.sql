-- ============================================================================
-- Migration 033: Power BI — Gráficos solicitados pelo chefe
--
-- Contexto:
--   O chefe pediu 3 séries temporais semanais:
--     1a. Total de aulas concluídas por semana — série completa desde 2023
--     1b. Ano contra ano — 2024, 2025 e 2026 sobrepostos por semana ISO
--     2.  Alunos que concluíram ao menos 1 aula por semana — desde 2023
--     3.  Média e mediana de aulas por aluno ativo na semana (geral)
--         Definição: não é total / total alunos. É a distribuição de aulas
--         entre quem estudou naquela semana. Ex: se 3 alunos fizeram 2, 4 e
--         10 aulas, avg = 5.3, mediana = 4.
--
-- Views criadas:
--   vw_weekly_global_stats        → gráficos 1a, 2 e 3 (uma linha por semana)
--   vw_yearly_weekly_comparison   → gráfico 1b (recriada com 2024+)
--
-- Views removidas:
--   vw_weekly_active_students     → absorvida em vw_weekly_global_stats
--   vw_yearly_weekly_comparison   → recriada (era 2025+, agora é 2024+)
--
-- Fonte de dados: lesson_progress.completed_at (única fonte de verdade para
-- conclusão de aulas). Não usa user_activities (legacy).
-- ============================================================================


-- ============================================================================
-- 1. Drop views being replaced
-- ============================================================================

DROP VIEW IF EXISTS vw_weekly_active_students CASCADE;
DROP VIEW IF EXISTS vw_yearly_weekly_comparison CASCADE;


-- ============================================================================
-- 2. vw_weekly_global_stats
--
-- Uma linha por semana ISO (segunda a domingo).
-- Cobre todos os dados disponíveis (desde out/2023).
--
-- Colunas:
--   week_start                   — data da segunda-feira da semana
--   total_lessons_completed      — total de aulas concluídas na semana
--   active_students              — alunos que concluíram ≥ 1 aula na semana
--   avg_lessons_per_active_student — média de aulas entre quem estudou
--   median_lessons_per_active_student — mediana de aulas entre quem estudou
--
-- Como usar no Power BI:
--   Gráfico 1a → Eixo X: week_start | Valores: total_lessons_completed
--   Gráfico 2  → Eixo X: week_start | Valores: active_students
--   Gráfico 3  → Eixo X: week_start | Valores: avg_ e/ou median_lessons_per_active_student
-- ============================================================================

CREATE VIEW vw_weekly_global_stats AS
WITH student_weekly AS (
    -- Uma linha por (aluno, semana): quantas aulas esse aluno fez nessa semana
    SELECT
        DATE_TRUNC('week', completed_at)::DATE  AS week_start,
        user_id,
        COUNT(*)                                AS lessons_completed
    FROM lesson_progress
    WHERE completed_at IS NOT NULL
    GROUP BY DATE_TRUNC('week', completed_at), user_id
)
SELECT
    week_start,
    -- Gráfico 1a
    SUM(lessons_completed)::BIGINT                                        AS total_lessons_completed,
    -- Gráfico 2
    COUNT(DISTINCT user_id)::BIGINT                                       AS active_students,
    -- Gráfico 3 — média: total aulas / # alunos que estudaram
    ROUND(AVG(lessons_completed), 2)                                      AS avg_lessons_per_active_student,
    -- Gráfico 3 — mediana: ponto central da distribuição de quem estudou
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lessons_completed)::NUMERIC AS median_lessons_per_active_student
FROM student_weekly
GROUP BY week_start
ORDER BY week_start;


-- ============================================================================
-- 3. vw_yearly_weekly_comparison (recriada)
--
-- Uma linha por (ano, semana ISO). Inclui 2024, 2025 e 2026.
-- Usada para sobrepor os 3 anos no mesmo eixo X (semana 1 a 52/53).
--
-- A semana 1 de 2024, 2025 e 2026 ficam alinhadas no eixo X → fácil ver
-- se 2026 está melhor ou pior que 2025/2024 na mesma época do ano.
--
-- Colunas:
--   year              — ano ISO (2024, 2025 ou 2026)
--   iso_week          — semana ISO (1 a 53)
--   lessons_completed — total de aulas concluídas naquela semana/ano
--   active_students   — alunos que estudaram naquela semana/ano
--
-- Como usar no Power BI:
--   Gráfico de Linhas: Eixo X = iso_week | Valores = lessons_completed | Legenda = year
--   Cada ano vira uma linha separada. Comparar visualmente semana a semana.
-- ============================================================================

CREATE VIEW vw_yearly_weekly_comparison AS
SELECT
    EXTRACT(ISOYEAR FROM completed_at)::INTEGER          AS year,
    EXTRACT(WEEK   FROM completed_at)::INTEGER           AS iso_week,
    COUNT(*)::BIGINT                                     AS lessons_completed,
    COUNT(DISTINCT user_id)::BIGINT                      AS active_students
FROM lesson_progress
WHERE completed_at IS NOT NULL
  AND EXTRACT(ISOYEAR FROM completed_at) >= 2024
GROUP BY
    EXTRACT(ISOYEAR FROM completed_at),
    EXTRACT(WEEK   FROM completed_at)
ORDER BY year, iso_week;


-- ============================================================================
-- 4. Índice para vw_weekly_global_stats e vw_yearly_weekly_comparison
--
-- A view global precisa varrer todo lesson_progress agrupando por
-- (DATE_TRUNC('week', completed_at), user_id). O índice cobrindo partial
-- de 2025+ já existe (idx_lesson_progress_2025plus). Para os dados de 2024
-- (180k linhas) o idx_lesson_progress_completed_at (WHERE NOT NULL) cobre.
-- Nenhum índice novo é necessário — o planner usa os existentes.
--
-- Para a view anual (2024+) adicionamos um índice covering que evita heap
-- fetch na contagem distinta de user_id:
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lesson_progress_2024plus
    ON lesson_progress(completed_at)
    INCLUDE (user_id)
    WHERE completed_at >= '2024-01-01';

ANALYZE lesson_progress;
