-- Migration 053: Clean up processed/replayed webhook_logs and update fn_new_enrollments_summary
-- Webhooks with status = 'processed' or 'replayed' are deleted immediately to free up database storage.
-- Only failed or skipped logs are retained for debugging and replay purposes.

-- 1. Remove existing processed and replayed webhook logs
DELETE FROM webhook_logs WHERE status IN ('processed', 'replayed');

-- 2. Update fn_new_enrollments_summary to query memberships table directly instead of webhook_logs
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
    COUNT(m.id) AS new_enrollments
  FROM memberships m
  JOIN membership_levels ml 
    ON ml.id = m.membership_level_id
  WHERE m.created_at >= p_from
    AND m.created_at <= (p_to + interval '1 day' - interval '1 second')
  GROUP BY ml.id, ml.name
  HAVING COUNT(m.id) > 0
  ORDER BY new_enrollments DESC;
END;
$$ LANGUAGE plpgsql;
