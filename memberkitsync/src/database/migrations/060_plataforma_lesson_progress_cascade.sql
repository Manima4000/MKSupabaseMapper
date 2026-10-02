-- ============================================================================
-- Migration 060: ON DELETE CASCADE em plataforma_lesson_progress.lesson_id
--
-- Contexto:
--   plataforma_lesson_progress NÃO faz parte do schema deste projeto
--   (memberkitsync) — foi criada por outro sistema que compartilha o mesmo
--   banco Supabase (aparenta ser o portal do aluno, registrando posição de
--   reprodução de vídeo: position_seconds, completed_at). Está documentada
--   aqui só porque bloqueia a limpeza de lessons órfãs feita por
--   fn_delete_orphaned_lessons (migration 059):
--
--     update or delete on table "lessons" violates foreign key constraint
--     "plataforma_lesson_progress_lesson_id_fkey" on table
--     "plataforma_lesson_progress"
--     Key (id)=(445) is still referenced from table
--     "plataforma_lesson_progress".
--
--   A FK original não tinha ON DELETE CASCADE (diferente da
--   lesson_progress do memberkitsync, que já cascateia). Quando uma
--   lesson é removida da Memberkit e some do catálogo sincronizado, o
--   progresso de vídeo associado a ela deixa de fazer sentido — mesmo
--   comportamento aplicado aqui.
-- ============================================================================

ALTER TABLE plataforma_lesson_progress
    DROP CONSTRAINT plataforma_lesson_progress_lesson_id_fkey;

ALTER TABLE plataforma_lesson_progress
    ADD CONSTRAINT plataforma_lesson_progress_lesson_id_fkey
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
