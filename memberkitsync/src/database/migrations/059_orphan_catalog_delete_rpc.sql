-- ============================================================================
-- Migration 059: RPC functions para deletar courses/sections/lessons órfãos
--
-- Contexto:
--   deleteOrphanedCourses/Sections/Lessons (course.repository.ts,
--   section.repository.ts, lesson.repository.ts) fazem DELETE ... WHERE
--   mk_id NOT IN (...) direto via PostgREST (.from('courses').delete()).
--
--   O papel "authenticator" (usado pelo PostgREST para TODAS as chamadas,
--   inclusive com a service_role key, já que a troca de papel é feita via
--   SET ROLE dentro da mesma sessão) tem statement_timeout=8s fixado em
--   nível de role/sessão. Isso vale mesmo quando a query roda "como"
--   service_role.
--
--   courses/sections/lessons são tabelas pequenas, mas o ON DELETE CASCADE
--   atinge tabelas de histórico bem grandes (lesson_progress ~1.9M linhas,
--   lesson_ratings ~730k linhas). Ao apagar um curso/section órfão que já
--   tem histórico real de alunos, o DELETE em cascata estoura os 8s:
--
--     SupabaseError: Falha ao deletar courses órfãos
--     details.message: "canceling statement due to statement timeout"
--     details.code: "57014"
--
--   Solução: mover o DELETE para dentro de funções SQL com um
--   statement_timeout estendido (SET statement_timeout no próprio
--   CREATE FUNCTION), que vale só durante a execução da função — sem
--   alterar o timeout global usado por qualquer outra chamada da API.
--   Chamadas via supabase.rpc() no lugar do .delete() direto.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_delete_orphaned_courses(known_mk_ids integer[])
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
SET statement_timeout = '10min'
SET lock_timeout = '1min'
AS $$
DECLARE
    deleted_count integer;
BEGIN
    IF known_mk_ids IS NULL OR array_length(known_mk_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    DELETE FROM courses WHERE mk_id <> ALL(known_mk_ids);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION fn_delete_orphaned_sections(known_mk_ids integer[])
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
SET statement_timeout = '10min'
SET lock_timeout = '1min'
AS $$
DECLARE
    deleted_count integer;
BEGIN
    IF known_mk_ids IS NULL OR array_length(known_mk_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    DELETE FROM sections WHERE mk_id <> ALL(known_mk_ids);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION fn_delete_orphaned_lessons(known_mk_ids integer[])
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
SET statement_timeout = '10min'
SET lock_timeout = '1min'
AS $$
DECLARE
    deleted_count integer;
BEGIN
    IF known_mk_ids IS NULL OR array_length(known_mk_ids, 1) IS NULL THEN
        RETURN 0;
    END IF;

    DELETE FROM lessons WHERE mk_id <> ALL(known_mk_ids);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Estas funções apagam dados em massa — não devem ser chamáveis por
-- anon/authenticated via RPC público (mesmo padrão de proteção usado em
-- rls_auto_enable(), migration 050). service_role mantém EXECUTE via
-- default privilege do schema public.
REVOKE ALL ON FUNCTION fn_delete_orphaned_courses(integer[])  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_delete_orphaned_sections(integer[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_delete_orphaned_lessons(integer[])  FROM PUBLIC, anon, authenticated;
