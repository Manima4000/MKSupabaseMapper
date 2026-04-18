-- ============================================================================
-- Migration 041: fn_active_students_count
--
-- Contexto:
--   O frontend buscava todas as linhas de mvw_active_students_flat filtradas
--   por período e contava user_id distintos em Node.js. Problema: o PostgREST
--   tem limite padrão de 1000 linhas por query. Com 1 ano de dados (~20k linhas),
--   só as primeiras 1000 eram retornadas → alunos únicos ficavam subcontados,
--   e períodos mais longos retornavam números MENORES (paradoxo).
--
-- Solução:
--   Função SQL que faz COUNT(DISTINCT user_id) direto no banco, sem trazer
--   linhas pro Node. Chamada via supabase.rpc().
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_active_students_count(p_from DATE, p_to DATE)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(DISTINCT user_id)::INTEGER
  FROM mvw_active_students_flat
  WHERE week_start >= p_from
    AND week_start <= p_to;
$$;

-- Verificação:
-- SELECT fn_active_students_count('2026-01-01', '2026-04-17');
