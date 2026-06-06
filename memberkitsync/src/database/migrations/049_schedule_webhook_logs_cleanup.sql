-- Schedules a daily pg_cron job to delete webhook_logs older than 10 days.
-- Runs at 03:00 UTC every day. Safe to re-run (ON CONFLICT DO UPDATE).

SELECT cron.schedule(
  'cleanup-old-webhook-logs',
  '0 3 * * *',
  $$DELETE FROM webhook_logs WHERE created_at < NOW() - INTERVAL '10 days'$$
);
