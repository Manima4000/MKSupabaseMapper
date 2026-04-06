-- Migration 008: Rebuild quiz_attempts to match the /quiz_attempts API response.
-- The original schema (course_id, answers, score) did not reflect the actual
-- API payload. Dropping and recreating while the table is still empty.

DROP TABLE IF EXISTS quiz_attempts;

CREATE TABLE quiz_attempts (
    id                        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mk_id                     INTEGER UNIQUE NOT NULL,
    user_id                   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_mk_id                INTEGER NOT NULL,
    quiz_title                TEXT NOT NULL DEFAULT '',
    answered_questions_count  INTEGER NOT NULL DEFAULT 0,
    correct_answers_count     INTEGER NOT NULL DEFAULT 0,
    started_at                TIMESTAMPTZ,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id    ON quiz_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_mk_id ON quiz_attempts (quiz_mk_id);

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON quiz_attempts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();
