-- Migration 015: add 'replayed' status to webhook_logs
-- The replay command marks successfully reprocessed webhooks as 'replayed'
-- so they don't appear in future replay runs. The previous constraint was
-- missing this value, causing the update to fail silently.

ALTER TABLE webhook_logs
  DROP CONSTRAINT IF EXISTS webhook_logs_status_check;

ALTER TABLE webhook_logs
  ADD CONSTRAINT webhook_logs_status_check
  CHECK (status IN ('received', 'processed', 'skipped', 'failed', 'replayed'));
