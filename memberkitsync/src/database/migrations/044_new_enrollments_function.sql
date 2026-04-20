CREATE OR REPLACE FUNCTION fn_new_enrollments_summary(p_from date, p_to date)
RETURNS TABLE (
  membership_level_id bigint,
  level_name text,
  new_enrollments bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ml.id AS membership_level_id,
    ml.name AS level_name,
    COUNT(w.id) AS new_enrollments
  FROM webhook_logs w
  JOIN membership_levels ml 
    ON ml.mk_id = (w.payload->'data'->'membership_level'->>'id')::integer
  WHERE w.event_type = 'membership.created'
    AND w.created_at >= p_from
    AND w.created_at <= (p_to + interval '1 day' - interval '1 second')
  GROUP BY ml.id, ml.name
  HAVING COUNT(w.id) > 0
  ORDER BY new_enrollments DESC;
END;
$$ LANGUAGE plpgsql;
