-- Migration 035: Rebuild vw_yearly_weekly_comparison with avg and median lessons per student
-- Adds avg_lessons_per_student and median_lessons_per_student columns for PowerBI year-over-year comparison

CREATE OR REPLACE VIEW vw_yearly_weekly_comparison AS
WITH per_student AS (
  SELECT
    EXTRACT(isoyear FROM completed_at)::int AS year,
    EXTRACT(week FROM completed_at)::int     AS iso_week,
    user_id,
    COUNT(*) AS student_lessons
  FROM lesson_progress
  WHERE completed_at IS NOT NULL
    AND EXTRACT(isoyear FROM completed_at) >= 2024
  GROUP BY 1, 2, 3
)
SELECT
  year,
  iso_week,
  SUM(student_lessons)::bigint                                                     AS lessons_completed,
  COUNT(DISTINCT user_id)::bigint                                                  AS active_students,
  ROUND(AVG(student_lessons)::numeric, 2)                                          AS avg_lessons_per_student,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY student_lessons)::numeric, 2)  AS median_lessons_per_student
FROM per_student
GROUP BY year, iso_week
ORDER BY year, iso_week;
