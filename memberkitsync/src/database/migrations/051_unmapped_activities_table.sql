-- ============================================================================
-- Migration 051: Tabela para atividades com trackable_type desconhecido
--
-- Contexto:
--   A antiga tabela user_activities (log genérico de todas as atividades)
--   foi removida do banco depois que a migration 017 normalizou os tipos
--   conhecidos em tabelas dedicadas (lesson_progress, forum_posts,
--   forum_comments, lesson_file_downloads, comments, quiz_attempts,
--   lesson_ratings). O código do orchestrator (routeActivity) ainda tinha um
--   caso "default" que gravava em user_activities para trackable_type que a
--   API do MemberKit retorna mas que o sync ainda não mapeia para uma
--   tabela — isso quebrava o sync com "Could not find table user_activities".
--
--   Esta migration recria um destino para esses casos, agora com nome
--   explícito (unmapped_activities), para não confundir com a antiga tabela
--   de log genérico. Serve como uma "fila de observação": se aparecer
--   volume aqui, é sinal de que vale a pena criar uma tabela dedicada para
--   aquele trackable_type específico.
-- ============================================================================

CREATE TABLE unmapped_activities (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER UNIQUE NOT NULL,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    mk_course_id    INTEGER,
    mk_lesson_id    INTEGER,
    trackable       JSONB,
    occurred_at     TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_unmapped_activities_user_id    ON unmapped_activities (user_id, occurred_at DESC);
CREATE INDEX idx_unmapped_activities_event_type ON unmapped_activities (event_type, occurred_at DESC);

ALTER TABLE unmapped_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_unmapped_activities" ON unmapped_activities
    FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Defesa em profundidade, mesmo padrão da migration 050: sem GRANT público.
REVOKE SELECT ON unmapped_activities FROM anon, authenticated;
