-- Migration 028: Preserve MemberKit's updated_at on upsert
--
-- Problem: trigger_set_updated_at() always overwrites updated_at with NOW()
-- on every UPDATE (including upsert-on-conflict), discarding the original
-- timestamp from MemberKit.
--
-- Fix: only auto-update if the caller did not explicitly provide a new value
-- (i.e., updated_at didn't change in the incoming row vs. the stored row).
-- This way:
--   - Passing mk.updated_at in the upsert → preserved ✅
--   - Not passing updated_at (legacy code) → trigger sets NOW() as before ✅

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
