-- ============================================================================
-- Migration 001: Create tables
-- MemberKit → Supabase sync database
-- ============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CATÁLOGO DE CONTEÚDO
-- ============================================================================

-- Categorias de cursos (agrupamento lógico)
CREATE TABLE categories (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cursos (ex: "Matemática 1 - ESA", "Matemática 2 - EsPCEx")
CREATE TABLE courses (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id               INTEGER NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    position            INTEGER NOT NULL DEFAULT 0,
    category_id         BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sections / Módulos (ex: "Módulo 1", "Módulo 2")
CREATE TABLE sections (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER NOT NULL UNIQUE,
    course_id       BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    slug            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aulas
CREATE TABLE lessons (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER NOT NULL UNIQUE,
    section_id      BIGINT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    position        INTEGER NOT NULL DEFAULT 0,
    slug            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vídeos vinculados a aulas (relação 1:1)
CREATE TABLE lesson_videos (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER UNIQUE,
    lesson_id       BIGINT NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
    uid             TEXT,
    source          TEXT,
    duration_seconds INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Arquivos/PDFs vinculados a aulas (relação 1:N)
CREATE TABLE lesson_files (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER UNIQUE,
    lesson_id       BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    url             TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TURMAS E ASSINATURAS
-- ============================================================================

-- Turmas (classrooms)
CREATE TABLE classrooms (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Níveis de assinatura (ex: "Assinatura ESA", "Assinatura EsPCEx")
CREATE TABLE membership_levels (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    trial_period    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relação N:N entre membership_levels e classrooms
CREATE TABLE membership_level_classrooms (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    membership_level_id     BIGINT NOT NULL REFERENCES membership_levels(id) ON DELETE CASCADE,
    classroom_id            BIGINT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    UNIQUE (membership_level_id, classroom_id)
);

-- ============================================================================
-- ALUNOS / MEMBROS
-- ============================================================================

-- Usuários (alunos)
CREATE TABLE users (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id               INTEGER NOT NULL UNIQUE,
    full_name           TEXT NOT NULL,
    email               TEXT NOT NULL UNIQUE,
    blocked             BOOLEAN NOT NULL DEFAULT FALSE,
    unlimited           BOOLEAN NOT NULL DEFAULT FALSE,
    sign_in_count       INTEGER NOT NULL DEFAULT 0,
    current_sign_in_at  TIMESTAMPTZ,
    last_seen_at        TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assinaturas do aluno (um aluno pode ter várias assinaturas ativas)
CREATE TABLE memberships (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id                   INTEGER NOT NULL UNIQUE,
    user_id                 BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    membership_level_id     BIGINT NOT NULL REFERENCES membership_levels(id) ON DELETE CASCADE,
    status                  TEXT NOT NULL DEFAULT 'inactive'
                            CHECK (status IN ('inactive', 'pending', 'active', 'expired')),
    expire_date             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matrículas (vínculo aluno ↔ curso ↔ turma)
CREATE TABLE enrollments (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER NOT NULL UNIQUE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id       BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    classroom_id    BIGINT REFERENCES classrooms(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'inactive'
                    CHECK (status IN ('inactive', 'pending', 'active', 'expired')),
    expire_date     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ACOMPANHAMENTO E PROGRESSO
-- ============================================================================

-- Progresso do aluno por aula (webhook: lesson_status_saved)
CREATE TABLE lesson_progress (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER UNIQUE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id       BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    progress        INTEGER NOT NULL DEFAULT 0,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, lesson_id)
);

-- Log de atividades genérico (todos os webhooks → histórico)
CREATE TABLE user_activities (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentários em aulas
CREATE TABLE comments (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER UNIQUE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id       BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tentativas de quiz
CREATE TABLE quiz_attempts (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id           INTEGER UNIQUE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id       BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    answers         JSONB NOT NULL DEFAULT '{}',
    score           NUMERIC(5,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- LOG DE WEBHOOKS (auditoria e replay)
-- ============================================================================

CREATE TABLE webhook_logs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received', 'processed', 'failed')),
    error_message   TEXT,
    processed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);