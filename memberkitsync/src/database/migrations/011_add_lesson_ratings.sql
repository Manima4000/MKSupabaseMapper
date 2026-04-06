-- Migration 011: add lesson_ratings table
-- Stores lesson star ratings submitted by students (rating.saved webhook).

CREATE TABLE IF NOT EXISTS lesson_ratings (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mk_id       INTEGER UNIQUE NOT NULL,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  stars       SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

CREATE TRIGGER set_lesson_ratings_updated_at
  BEFORE UPDATE ON lesson_ratings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_lesson_ratings_user_id   ON lesson_ratings(user_id);
CREATE INDEX idx_lesson_ratings_lesson_id ON lesson_ratings(lesson_id);
