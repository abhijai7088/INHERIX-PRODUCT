-- Migration 0016: Add Super Admin Approval Gate
-- Adds PENDING_SUPER_ADMIN_APPROVAL status and associated columns to trigger_requests

-- Step 1: Add new status value to the trigger_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'trigger_status' AND e.enumlabel = 'PENDING_SUPER_ADMIN_APPROVAL'
  ) THEN
    ALTER TYPE trigger_status ADD VALUE 'PENDING_SUPER_ADMIN_APPROVAL';
  END IF;
END $$;

-- Step 2: Add Super Admin decision columns to trigger_requests
ALTER TABLE trigger_requests
  ADD COLUMN IF NOT EXISTS super_admin_decision_note TEXT,
  ADD COLUMN IF NOT EXISTS super_admin_reviewed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS super_admin_reviewed_at TIMESTAMP;

