-- Migration 010: Add payload_hash to webhook_logs for idempotency
-- Allows the server to detect and skip already-processed webhooks (MK retries)

ALTER TABLE webhook_logs
  ADD COLUMN IF NOT EXISTS payload_hash TEXT;

-- Index for fast dedup lookup (checking processed webhooks by hash)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_payload_hash
  ON webhook_logs (payload_hash)
  WHERE payload_hash IS NOT NULL;
