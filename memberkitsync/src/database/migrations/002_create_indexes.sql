-- ============================================================================
-- Migration 002: Create indexes
-- Otimização de queries frequentes
-- ============================================================================

-- ============================================================================
-- CATÁLOGO DE CONTEÚDO
-- ============================================================================

-- Buscar sections de um curso (ordenadas por posição)
CREATE INDEX idx_sections_course_id ON sections (course_id, position);

-- Buscar lessons de uma section (ordenadas por posição)
CREATE INDEX idx_lessons_section_id ON lessons (section_id, position);

-- Buscar arquivos de uma aula
CREATE INDEX idx_lesson_files_lesson_id ON lesson_files (lesson_id);

-- ============================================================================
-- TURMAS E ASSINATURAS
-- ============================================================================

-- Buscar classrooms de um membership_level (e vice-versa)
CREATE INDEX idx_mlc_membership_level_id ON membership_level_classrooms (membership_level_id);
CREATE INDEX idx_mlc_classroom_id ON membership_level_classrooms (classroom_id);

-- ============================================================================
-- ALUNOS
-- ============================================================================

-- Buscar usuário por email (login, webhook lookup)
-- Já coberto pela UNIQUE constraint em users.email

-- Buscar assinaturas de um aluno
CREATE INDEX idx_memberships_user_id ON memberships (user_id);

-- Buscar assinaturas por status (listar alunos ativos)
CREATE INDEX idx_memberships_status ON memberships (status);

-- Buscar assinaturas por nível + status (ex: todos ativos na "Assinatura ESA")
CREATE INDEX idx_memberships_level_status ON memberships (membership_level_id, status);

-- Buscar assinaturas próximas de expirar
CREATE INDEX idx_memberships_expire_date ON memberships (expire_date)
    WHERE expire_date IS NOT NULL;

-- Buscar matrículas de um aluno
CREATE INDEX idx_enrollments_user_id ON enrollments (user_id);

-- Buscar matrículas de um curso
CREATE INDEX idx_enrollments_course_id ON enrollments (course_id);

-- Buscar matrículas por curso + status (alunos ativos em um curso)
CREATE INDEX idx_enrollments_course_status ON enrollments (course_id, status);

-- Buscar matrículas por turma
CREATE INDEX idx_enrollments_classroom_id ON enrollments (classroom_id);

-- ============================================================================
-- ACOMPANHAMENTO E PROGRESSO
-- ============================================================================

-- Buscar progresso de um aluno (todas as aulas)
CREATE INDEX idx_lesson_progress_user_id ON lesson_progress (user_id);

-- Buscar quem completou uma aula específica
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress (lesson_id);

-- Buscar aulas completadas (para calcular % do curso)
CREATE INDEX idx_lesson_progress_completed ON lesson_progress (user_id, completed_at)
    WHERE completed_at IS NOT NULL;

-- Atividades de um aluno (ordenadas por data)
CREATE INDEX idx_user_activities_user_id ON user_activities (user_id, occurred_at DESC);

-- Atividades por tipo de evento (ex: buscar todos os downloads)
CREATE INDEX idx_user_activities_event_type ON user_activities (event_type, occurred_at DESC);

-- Comentários por aula
CREATE INDEX idx_comments_lesson_id ON comments (lesson_id);

-- Comentários por aluno
CREATE INDEX idx_comments_user_id ON comments (user_id);

-- Quiz attempts por aluno
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts (user_id);

-- Quiz attempts por curso
CREATE INDEX idx_quiz_attempts_course_id ON quiz_attempts (course_id);

-- ============================================================================
-- WEBHOOK LOGS
-- ============================================================================

-- Buscar logs por tipo de evento
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs (event_type, created_at DESC);

-- Buscar logs com falha (para retry)
CREATE INDEX idx_webhook_logs_failed ON webhook_logs (status, created_at DESC)
    WHERE status = 'failed';