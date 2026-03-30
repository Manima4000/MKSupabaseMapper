-- ============================================================================
-- Migration 003: Functions, views e triggers auxiliares
-- ============================================================================

-- ============================================================================
-- TRIGGER: updated_at automático
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica o trigger em todas as tabelas que têm updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'categories', 'courses', 'sections', 'lessons',
        'classrooms', 'membership_levels',
        'users', 'memberships', 'enrollments',
        'lesson_progress', 'comments'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER set_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW
             EXECUTE FUNCTION trigger_set_updated_at()',
            t
        );
    END LOOP;
END;
$$;

-- ============================================================================
-- VIEW: Progresso do aluno por curso
-- Calcula % de conclusão, total de aulas, aulas completadas, última atividade
-- ============================================================================

CREATE OR REPLACE VIEW vw_student_course_progress AS
SELECT
    e.user_id,
    e.course_id,
    c.name                                      AS course_name,
    u.full_name                                 AS student_name,
    u.email                                     AS student_email,
    e.status                                    AS enrollment_status,
    COUNT(l.id)                                 AS total_lessons,
    COUNT(lp.completed_at)                      AS completed_lessons,
    CASE
        WHEN COUNT(l.id) = 0 THEN 0
        ELSE ROUND(
            (COUNT(lp.completed_at)::NUMERIC / COUNT(l.id)) * 100, 1
        )
    END                                         AS progress_pct,
    MAX(lp.completed_at)                        AS last_activity_at
FROM enrollments e
JOIN users u ON u.id = e.user_id
JOIN courses c ON c.id = e.course_id
JOIN sections s ON s.course_id = c.id
JOIN lessons l ON l.section_id = s.id
LEFT JOIN lesson_progress lp
    ON lp.lesson_id = l.id
    AND lp.user_id = e.user_id
    AND lp.completed_at IS NOT NULL
GROUP BY e.user_id, e.course_id, c.name, u.full_name, u.email, e.status;

-- ============================================================================
-- VIEW: Progresso do aluno por módulo (section)
-- Granularidade mais fina para acompanhamento detalhado
-- ============================================================================

CREATE OR REPLACE VIEW vw_student_section_progress AS
SELECT
    e.user_id,
    s.id                                        AS section_id,
    s.course_id,
    c.name                                      AS course_name,
    s.name                                      AS section_name,
    s.position                                  AS section_position,
    u.full_name                                 AS student_name,
    COUNT(l.id)                                 AS total_lessons,
    COUNT(lp.completed_at)                      AS completed_lessons,
    CASE
        WHEN COUNT(l.id) = 0 THEN 0
        ELSE ROUND(
            (COUNT(lp.completed_at)::NUMERIC / COUNT(l.id)) * 100, 1
        )
    END                                         AS progress_pct
FROM enrollments e
JOIN users u ON u.id = e.user_id
JOIN courses c ON c.id = e.course_id
JOIN sections s ON s.course_id = c.id
JOIN lessons l ON l.section_id = s.id
LEFT JOIN lesson_progress lp
    ON lp.lesson_id = l.id
    AND lp.user_id = e.user_id
    AND lp.completed_at IS NOT NULL
GROUP BY e.user_id, s.id, s.course_id, c.name, s.name, s.position, u.full_name;

-- ============================================================================
-- VIEW: Alunos inativos (não acessam há mais de X dias)
-- Útil para campanhas de reativação
-- ============================================================================

CREATE OR REPLACE VIEW vw_inactive_students AS
SELECT
    u.id                AS user_id,
    u.full_name,
    u.email,
    u.last_seen_at,
    u.sign_in_count,
    EXTRACT(DAY FROM NOW() - u.last_seen_at)::INTEGER AS days_inactive,
    ARRAY_AGG(DISTINCT ml.name) FILTER (WHERE m.status = 'active')
                        AS active_subscriptions
FROM users u
LEFT JOIN memberships m ON m.user_id = u.id
LEFT JOIN membership_levels ml ON ml.id = m.membership_level_id
WHERE u.last_seen_at < NOW() - INTERVAL '7 days'
  AND u.blocked = FALSE
GROUP BY u.id, u.full_name, u.email, u.last_seen_at, u.sign_in_count
ORDER BY u.last_seen_at ASC;

-- ============================================================================
-- VIEW: Resumo de assinaturas ativas por nível
-- Dashboard de métricas
-- ============================================================================

CREATE OR REPLACE VIEW vw_subscription_summary AS
SELECT
    ml.id               AS membership_level_id,
    ml.name             AS level_name,
    COUNT(m.id) FILTER (WHERE m.status = 'active')   AS active_count,
    COUNT(m.id) FILTER (WHERE m.status = 'pending')  AS pending_count,
    COUNT(m.id) FILTER (WHERE m.status = 'expired')  AS expired_count,
    COUNT(m.id) FILTER (WHERE m.status = 'inactive') AS inactive_count,
    COUNT(m.id)                                       AS total_count
FROM membership_levels ml
LEFT JOIN memberships m ON m.membership_level_id = ml.id
GROUP BY ml.id, ml.name
ORDER BY ml.name;

-- ============================================================================
-- FUNCTION: Buscar progresso completo de um aluno
-- Retorna JSON estruturado com cursos → módulos → aulas
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_student_full_progress(p_user_id BIGINT)
RETURNS JSONB AS $$
SELECT COALESCE(
    JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'course_id',    c.id,
            'course_name',  c.name,
            'enrollment_status', e.status,
            'sections',     (
                SELECT COALESCE(JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'section_id',   s.id,
                        'section_name', s.name,
                        'position',     s.position,
                        'lessons',      (
                            SELECT COALESCE(JSONB_AGG(
                                JSONB_BUILD_OBJECT(
                                    'lesson_id',    l.id,
                                    'title',        l.title,
                                    'position',     l.position,
                                    'completed',    (lp.completed_at IS NOT NULL),
                                    'completed_at', lp.completed_at,
                                    'progress',     COALESCE(lp.progress, 0)
                                ) ORDER BY l.position
                            ), '[]'::JSONB)
                            FROM lessons l
                            LEFT JOIN lesson_progress lp
                                ON lp.lesson_id = l.id
                                AND lp.user_id = p_user_id
                            WHERE l.section_id = s.id
                        )
                    ) ORDER BY s.position
                ), '[]'::JSONB)
                FROM sections s
                WHERE s.course_id = c.id
            )
        )
    ),
    '[]'::JSONB
)
FROM enrollments e
JOIN courses c ON c.id = e.course_id
WHERE e.user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- FUNCTION: Lookup de ID interno pelo mk_id
-- Usada nos webhooks para traduzir IDs da MemberKit → IDs locais
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_resolve_mk_id(
    p_table_name TEXT,
    p_mk_id     INTEGER
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    EXECUTE format('SELECT id FROM %I WHERE mk_id = $1', p_table_name)
        INTO v_id
        USING p_mk_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql STABLE;