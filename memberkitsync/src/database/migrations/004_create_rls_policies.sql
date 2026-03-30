-- ============================================================================
-- Migration 004: Row Level Security (RLS)
-- Proteção de acesso no Supabase
-- ============================================================================

-- ============================================================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================================

ALTER TABLE categories                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_videos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_files                ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_levels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_level_classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs                ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES: service_role (backend / API do Fastify)
-- O backend usa a service_role key, que tem acesso total.
-- Essas policies garantem que o service_role pode fazer tudo.
-- ============================================================================

-- Catálogo (leitura pública, escrita via service_role)
CREATE POLICY "service_role_all_categories" ON categories
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_courses" ON courses
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_sections" ON sections
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_lessons" ON lessons
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_lesson_videos" ON lesson_videos
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_lesson_files" ON lesson_files
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Turmas e assinaturas
CREATE POLICY "service_role_all_classrooms" ON classrooms
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_membership_levels" ON membership_levels
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_mlc" ON membership_level_classrooms
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Alunos
CREATE POLICY "service_role_all_users" ON users
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_memberships" ON memberships
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_enrollments" ON enrollments
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Acompanhamento
CREATE POLICY "service_role_all_lesson_progress" ON lesson_progress
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_user_activities" ON user_activities
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_comments" ON comments
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "service_role_all_quiz_attempts" ON quiz_attempts
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Webhook logs
CREATE POLICY "service_role_all_webhook_logs" ON webhook_logs
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ============================================================================
-- POLICIES: anon (acesso público - apenas leitura do catálogo)
-- Para caso vocês exponham dados públicos no futuro (ex: página de cursos)
-- ============================================================================

CREATE POLICY "anon_read_categories" ON categories
    FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_courses" ON courses
    FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_sections" ON sections
    FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_lessons" ON lessons
    FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_lesson_videos" ON lesson_videos
    FOR SELECT TO anon USING (TRUE);

CREATE POLICY "anon_read_membership_levels" ON membership_levels
    FOR SELECT TO anon USING (TRUE);