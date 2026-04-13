-- Migration 027: Add phone column to users table
-- Phone data comes from MemberKit metadata (phone_local_code + phone_number)

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
