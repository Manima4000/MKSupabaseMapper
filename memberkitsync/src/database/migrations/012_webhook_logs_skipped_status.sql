-- Migration 012: add 'skipped' status to webhook_logs
-- Webhooks that could not be processed due to a missing FK reference (e.g. user
-- not yet in the DB) are now stored with status='skipped' instead of 'processed'.
-- The error_message column stores the reason for skipping.

ALTER TABLE webhook_logs
  DROP CONSTRAINT IF EXISTS webhook_logs_status_check;

ALTER TABLE webhook_logs
  ADD CONSTRAINT webhook_logs_status_check
  CHECK (status IN ('received', 'processed', 'skipped', 'failed'));
