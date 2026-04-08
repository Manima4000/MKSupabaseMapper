-- ============================================================================
-- Migration 014: Rebuild and expand analytics views
--
-- Motivação:
--   - vw_inactive_students e vw_subscription_summary vieram da 003 e nunca
--     foram revisadas após a remoção do campo `progress` e a criação das
--     tabelas quiz_attempts (008) e lesson_ratings (011).
--   - Nenhuma view cobria quiz_attempts, lesson_ratings ou a visão consolidada
--     por aluno.
--
-- Esta migration:
--   1. Recria views existentes (DROP + CREATE para garantir definição limpa)
--   2. Adiciona novas views analíticas
-- ============================================================================


-- ============================================================================
-- 1. RECRIAÇÃO DAS VIEWS EXISTENTES (definições limpas e atualizadas)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_inactive_students
-- Alunos que não acessam há mais de 7 dias e têm assinatura ativa.
-- Atualização: adiciona total de aulas concluídas e data da última conclusão.
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS vw_inactive_students CASCADE;

CREATE VIEW vw_inactive_students AS
SELECT
    u.id                                                            AS user_id,
    u.full_name,
    u.email,
    u.last_seen_at,
    u.sign_in_count,
    EXTRACT(DAY FROM NOW() - u.last_seen_at)::INTEGER               AS days_inactive,
    ARRAY_AGG(DISTINCT ml.name) FILTER (WHERE m.status = 'active')  AS active_subscriptions,
    COUNT(DISTINCT lp.lesson_id)                                    AS total_lessons_completed,
    MAX(lp.completed_at)                                            AS last_lesson_completed_at
FROM users u
LEFT JOIN memberships m         ON m.user_id          = u.id
LEFT JOIN membership_levels ml  ON ml.id              = m.membership_level_id
LEFT JOIN vw_lesson_progress lp ON lp.user_id         = u.id
WHERE u.last_seen_at < NOW() - INTERVAL '7 days'
  AND u.blocked = FALSE
  AND EXISTS (
      SELECT 1 FROM memberships m2
      WHERE m2.user_id = u.id AND m2.status = 'active'
  )
GROUP BY u.id, u.full_name, u.email, u.last_seen_at, u.sign_in_count
ORDER BY u.last_seen_at ASC;


-- ----------------------------------------------------------------------------
-- vw_subscription_summary
-- Painel de assinaturas: contagem por status e por plano.
-- Atualização: adiciona alunos que concluíram ao menos 1 aula (engaged).
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS vw_subscription_summary CASCADE;

CREATE VIEW vw_subscription_summary AS
SELECT
    ml.id                                                                   AS membership_level_id,
    ml.name                                                                 AS level_name,
    COUNT(m.id) FILTER (WHERE m.status = 'active')                          AS active_count,
    COUNT(m.id) FILTER (WHERE m.status = 'pending')                         AS pending_count,
    COUNT(m.id) FILTER (WHERE m.status = 'expired')                         AS expired_count,
    COUNT(m.id) FILTER (WHERE m.status = 'inactive')                        AS inactive_count,
    COUNT(m.id)                                                              AS total_count,
    -- Engajados: assinantes ativos que já concluíram ao menos 1 aula
    COUNT(DISTINCT m.user_id) FILTER (
        WHERE m.status = 'active'
          AND EXISTS (
              SELECT 1 FROM vw_lesson_progress lp WHERE lp.user_id = m.user_id
          )
    )                                                                        AS engaged_active_count
FROM membership_levels ml
LEFT JOIN memberships m ON m.membership_level_id = ml.id
GROUP BY ml.id, ml.name
ORDER BY ml.name;


-- ============================================================================
-- 2. NOVAS VIEWS ANALÍTICAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vw_student_overview
-- Uma linha por aluno com os principais indicadores consolidados:
-- assinaturas ativas, matrículas, aulas concluídas, quizzes, ratings, etc.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_student_overview AS
SELECT
    u.id                                                                    AS user_id,
    u.mk_id,
    u.full_name,
    u.email,
    u.blocked,
    u.sign_in_count,
    u.last_seen_at,
    EXTRACT(DAY FROM NOW() - u.last_seen_at)::INTEGER                       AS days_since_last_seen,

    -- Assinaturas
    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active')                 AS active_subscriptions,
    ARRAY_AGG(DISTINCT ml.name) FILTER (WHERE m.status = 'active')          AS active_subscription_names,

    -- Matrículas em cursos ativos
    COUNT(DISTINCT e.course_id) FILTER (WHERE e.status = 'active')          AS enrolled_courses,

    -- Progresso em aulas
    COUNT(DISTINCT lp.lesson_id)                                            AS total_lessons_completed,
    MAX(lp.completed_at)                                                    AS last_lesson_completed_at,

    -- Quizzes
    COUNT(DISTINCT qa.id)                                                   AS total_quiz_attempts,
    CASE
        WHEN SUM(qa.answered_questions_count) = 0 OR SUM(qa.answered_questions_count) IS NULL THEN NULL
        ELSE ROUND(
            SUM(qa.correct_answers_count)::NUMERIC / SUM(qa.answered_questions_count) * 100, 1
        )
    END                                                                     AS quiz_accuracy_pct,

    -- Avaliações de aulas
    COUNT(DISTINCT lr.lesson_id)                                            AS total_lessons_rated,
    ROUND(AVG(lr.stars), 1)                                                 AS avg_rating_given,

    -- Comentários
    COUNT(DISTINCT co.id)                                                   AS total_comments

FROM users u
LEFT JOIN memberships m         ON m.user_id             = u.id
LEFT JOIN membership_levels ml  ON ml.id                 = m.membership_level_id
LEFT JOIN enrollments e         ON e.user_id             = u.id
LEFT JOIN vw_lesson_progress lp ON lp.user_id            = u.id
LEFT JOIN quiz_attempts qa      ON qa.user_id            = u.id
LEFT JOIN lesson_ratings lr     ON lr.user_id            = u.id
LEFT JOIN comments co           ON co.user_id            = u.id
GROUP BY u.id, u.mk_id, u.full_name, u.email, u.blocked, u.sign_in_count, u.last_seen_at;


-- ----------------------------------------------------------------------------
-- vw_lesson_stats
-- Por aula: total de alunos que concluíram, taxa de conclusão (sobre matriculados)
-- e avaliação média. Útil para identificar aulas populares ou problemáticas.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_lesson_stats AS
SELECT
    l.id                                                AS lesson_id,
    l.mk_id                                             AS lesson_mk_id,
    l.title,
    l.position                                          AS lesson_position,
    s.id                                                AS section_id,
    s.name                                              AS section_name,
    c.id                                                AS course_id,
    c.name                                              AS course_name,

    -- Conclusões
    COUNT(DISTINCT lp.user_id)                          AS total_completions,

    -- Matriculados no curso (ativos) — denominador da taxa
    COUNT(DISTINCT e.user_id)                           AS total_enrolled,

    -- Taxa de conclusão (%)
    CASE
        WHEN COUNT(DISTINCT e.user_id) = 0 THEN NULL
        ELSE ROUND(
            COUNT(DISTINCT lp.user_id)::NUMERIC / COUNT(DISTINCT e.user_id) * 100, 1
        )
    END                                                 AS completion_rate_pct,

    -- Avaliações
    COUNT(DISTINCT lr.user_id)                          AS total_ratings,
    ROUND(AVG(lr.stars), 1)                             AS avg_stars,

    -- Comentários
    COUNT(DISTINCT co.id)                               AS total_comments

FROM lessons l
JOIN sections s             ON s.id       = l.section_id
JOIN courses c              ON c.id       = s.course_id
LEFT JOIN enrollments e     ON e.course_id = c.id AND e.status = 'active'
LEFT JOIN vw_lesson_progress lp ON lp.lesson_id = l.id
LEFT JOIN lesson_ratings lr ON lr.lesson_id = l.id
LEFT JOIN comments co       ON co.lesson_id = l.id
GROUP BY l.id, l.mk_id, l.title, l.position, s.id, s.name, c.id, c.name;


-- ----------------------------------------------------------------------------
-- vw_course_funnel
-- Funil de conclusão por curso:
--   matriculados → iniciaram (≥1 aula) → metade (≥50%) → concluíram (100%)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_course_funnel AS
SELECT
    c.id                                                            AS course_id,
    c.name                                                          AS course_name,
    cat.name                                                        AS category_name,
    COUNT(DISTINCT l.id)                                            AS total_lessons,
    COUNT(DISTINCT e.user_id)                                       AS enrolled_students,
    COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.completed_lessons >= 1)    AS started_students,
    COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.progress_pct >= 50)        AS halfway_students,
    COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.progress_pct = 100)        AS completed_students,
    -- Taxa de conclusão total
    CASE
        WHEN COUNT(DISTINCT e.user_id) = 0 THEN NULL
        ELSE ROUND(
            COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.progress_pct = 100)::NUMERIC
            / COUNT(DISTINCT e.user_id) * 100, 1
        )
    END                                                             AS completion_rate_pct
FROM courses c
LEFT JOIN categories cat    ON cat.id      = c.category_id
LEFT JOIN sections s        ON s.course_id = c.id
LEFT JOIN lessons l         ON l.section_id = s.id
LEFT JOIN enrollments e     ON e.course_id  = c.id AND e.status = 'active'
LEFT JOIN vw_student_course_progress cp ON cp.course_id = c.id
GROUP BY c.id, c.name, cat.name;


-- ----------------------------------------------------------------------------
-- vw_student_quiz_summary
-- Por aluno: desempenho consolidado em quizzes (só aparece quem tentou).
-- Útil para identificar alunos com dificuldades ou alto desempenho.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_student_quiz_summary AS
SELECT
    u.id                                                    AS user_id,
    u.full_name,
    u.email,
    COUNT(qa.id)                                            AS total_attempts,
    COUNT(DISTINCT qa.quiz_mk_id)                           AS distinct_quizzes_attempted,
    SUM(qa.answered_questions_count)                        AS total_questions_answered,
    SUM(qa.correct_answers_count)                           AS total_correct_answers,
    CASE
        WHEN SUM(qa.answered_questions_count) = 0 THEN 0
        ELSE ROUND(
            SUM(qa.correct_answers_count)::NUMERIC / SUM(qa.answered_questions_count) * 100, 1
        )
    END                                                     AS overall_accuracy_pct,
    MAX(qa.created_at)                                      AS last_attempt_at
FROM users u
JOIN quiz_attempts qa ON qa.user_id = u.id
GROUP BY u.id, u.full_name, u.email;


-- ----------------------------------------------------------------------------
-- vw_lesson_ratings_summary
-- Por aula: distribuição detalhada de estrelas (1–5) e média.
-- Útil para rankear aulas mais bem avaliadas.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_lesson_ratings_summary AS
SELECT
    l.id                                                    AS lesson_id,
    l.title,
    s.name                                                  AS section_name,
    c.name                                                  AS course_name,
    COUNT(lr.id)                                            AS total_ratings,
    ROUND(AVG(lr.stars), 2)                                 AS avg_stars,
    COUNT(lr.id) FILTER (WHERE lr.stars = 5)                AS stars_5,
    COUNT(lr.id) FILTER (WHERE lr.stars = 4)                AS stars_4,
    COUNT(lr.id) FILTER (WHERE lr.stars = 3)                AS stars_3,
    COUNT(lr.id) FILTER (WHERE lr.stars = 2)                AS stars_2,
    COUNT(lr.id) FILTER (WHERE lr.stars = 1)                AS stars_1
FROM lesson_ratings lr
JOIN lessons l  ON l.id  = lr.lesson_id
JOIN sections s ON s.id  = l.section_id
JOIN courses c  ON c.id  = s.course_id
GROUP BY l.id, l.title, s.name, c.name
ORDER BY avg_stars DESC;
