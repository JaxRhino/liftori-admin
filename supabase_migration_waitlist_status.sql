-- Migration: Add status column to waitlist_signups
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/qlerfkdyslndjbaltkwo/sql

ALTER TABLE waitlist_signups
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'invited'));

-- Optional: add index for filtering by status
CREATE INDEX IF NOT EXISTS waitlist_signups_status_idx ON waitlist_signups (status);

-- Optional: add notes column for internal review notes
ALTER TABLE waitlist_signups
  ADD COLUMN IF NOT EXISTS review_notes text;
