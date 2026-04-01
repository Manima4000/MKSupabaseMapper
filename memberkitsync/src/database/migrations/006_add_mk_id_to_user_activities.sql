-- Migration 006: Add mk_id to user_activities for idempotent sync
-- Run this in the Supabase SQL Editor before running syncActivities.

ALTER TABLE user_activities
  ADD COLUMN IF NOT EXISTS mk_id INTEGER;

ALTER TABLE user_activities
  ADD CONSTRAINT IF NOT EXISTS user_activities_mk_id_key UNIQUE (mk_id);
