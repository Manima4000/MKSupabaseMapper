-- ============================================================================
-- Migration 038: vw_active_students_flat
--
-- Contexto:
--   O card "Alunos Ativos" no Power BI estava mostrando ~34k quando filtrado
--   por "Ano atual". O problema: a view semanal (vw_weekly_global_stats) já
--   retorna active_students como um COUNT pré-agregado por semana. O Power BI
--   soma esses valores → um aluno que estudou 40 semanas é contado 40 vezes.
--
--   Para contar alunos únicos em qualquer período (semana, mês, ano), o Power BI
--   precisa de uma view com UMA LINHA POR ALUNO POR SEMANA contendo o user_id,
--   para poder aplicar DISTINCTCOUNT(user_id) com seu próprio filtro de data.
--
-- View criada:
--   vw_active_students_flat
--     Uma linha por (user_id, week_start).
--     Inclui nome, email e semana de atividade.
--     Power BI filtra por week_start (semana/mês/ano) e usa DISTINCTCOUNT(user_id).
--
-- Como usar no Power BI:
--   1. Conectar a vw_active_students_flat
--   2. Criar medida DAX:
--        Alunos Ativos = DISTINCTCOUNT(vw_active_students_flat[user_id])
--   3. Usar essa medida no card "Alunos Ativos"
--   4. A segmentação temporal (semana/mês/ano) filtra week_start → DISTINCTCOUNT
--      conta cada aluno apenas uma vez no período selecionado.
-- ============================================================================

CREATE OR REPLACE VIEW vw_active_students_flat AS
SELECT
    lp.user_id,
    u.full_name,
    u.email,
    DATE_TRUNC('week', lp.completed_at)::DATE  AS week_start,
    COUNT(*)::INTEGER                           AS lessons_in_week
FROM lesson_progress lp
JOIN users u ON u.id = lp.user_id
WHERE lp.completed_at IS NOT NULL
GROUP BY lp.user_id, u.full_name, u.email, DATE_TRUNC('week', lp.completed_at);
