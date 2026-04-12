-- ============================================================================
-- Migration 020: Replace UNIQUE (user_id, occurred_at) with UNIQUE (user_id, file_id)
--                on lesson_file_downloads
--
-- Context: The original unique key (user_id, occurred_at) was intended for dedup,
-- but it breaks webhook reprocessing because the same download event is replayed
-- with the same file_id. The semantically correct key is (user_id, file_id):
-- a student downloading the same file is idempotent regardless of timestamp.
--
-- Note: file_id can be NULL for legacy rows backfilled from user_activities.
-- PostgreSQL treats NULL != NULL in UNIQUE constraints, so multiple NULL rows
-- per user are still allowed — only non-null file_id pairs are deduplicated.
-- ============================================================================

-- Step 1: Drop the old constraint if it exists (safe even if migration 017 was partial)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lesson_file_downloads_user_id_occurred_at_key'
          AND conrelid = 'lesson_file_downloads'::regclass
    ) THEN
        ALTER TABLE lesson_file_downloads
            DROP CONSTRAINT lesson_file_downloads_user_id_occurred_at_key;
    END IF;
END
$$;

-- Step 2: Remove duplicate (user_id, file_id) pairs where file_id IS NOT NULL,
--         keeping the row with the smallest id (first inserted)
DELETE FROM lesson_file_downloads
WHERE file_id IS NOT NULL
  AND id NOT IN (
      SELECT MIN(id)
      FROM lesson_file_downloads
      WHERE file_id IS NOT NULL
      GROUP BY user_id, file_id
  );

-- Step 3: Add the new UNIQUE constraint on (user_id, file_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'lesson_file_downloads_user_id_file_id_key'
          AND conrelid = 'lesson_file_downloads'::regclass
    ) THEN
        ALTER TABLE lesson_file_downloads
            ADD CONSTRAINT lesson_file_downloads_user_id_file_id_key
            UNIQUE (user_id, file_id);
    END IF;
END
$$;
