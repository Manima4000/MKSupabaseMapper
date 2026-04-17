-- Migration 036: Add week_start to vw_yearly_weekly_comparison
-- week_start is the Monday (ISO week start) as a DATE so Power BI can use it as a slicer/date dimension
-- Must DROP first because CREATE OR REPLACE cannot insert a new column before existing ones

DROP VIEW IF EXISTS vw_yearly_weekly_comparison;

CREATE VIEW vw_yearly_weekly_comparison AS
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
  to_date(year::text || lpad(iso_week::text, 2, '0'), 'IYYYIW')              AS week_start,
  SUM(student_lessons)::bigint                                                AS lessons_completed,
  COUNT(DISTINCT user_id)::bigint                                             AS active_students,
  ROUND(AVG(student_lessons)::numeric, 2)                                     AS avg_lessons_per_student,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY student_lessons)::numeric, 2) AS median_lessons_per_student
FROM per_student
GROUP BY year, iso_week
ORDER BY year, iso_week;
