-- ============================================================================
-- Migration 054: vw_membership_courses
--
-- Answers "which courses are included in each membership/subscription plan?"
-- by walking membership_levels -> membership_level_classrooms -> classrooms
-- (via the course_id resolved in migration 053) -> courses. Classrooms whose
-- course_id could not be resolved contribute no course to the plan, which is
-- why this joins to courses (not LEFT JOINs).
-- ============================================================================

CREATE OR REPLACE VIEW vw_membership_courses AS
SELECT
    ml.id    AS membership_level_id,
    ml.name  AS membership_level_name,
    c.id     AS course_id,
    c.name   AS course_name,
    cl.id    AS classroom_id,
    cl.name  AS classroom_name
FROM membership_levels ml
JOIN membership_level_classrooms mlc ON mlc.membership_level_id = ml.id
JOIN classrooms cl ON cl.id = mlc.classroom_id
JOIN courses c ON c.id = cl.course_id;
