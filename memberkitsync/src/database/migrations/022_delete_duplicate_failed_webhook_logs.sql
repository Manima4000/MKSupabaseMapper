-- Migration 022: Remove failed webhook_logs that are duplicates of already-processed ones
--
-- Problem: When replaying failed webhooks, the idempotency check (isAlreadyProcessed)
-- finds a processed record with the same payload_hash and returns early — but never
-- updates the failed log. These failed logs accumulate and will never be processable.
--
-- Solution: Delete failed logs whose payload_hash already exists in a processed log.

DELETE FROM webhook_logs
WHERE status = 'failed'
  AND payload_hash IN (
    SELECT payload_hash
    FROM webhook_logs
    WHERE status = 'processed'
      AND payload_hash IS NOT NULL
  );
