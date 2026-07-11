DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trigger_status' AND EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'trigger_status' AND e.enumlabel = 'DRAFT'
  )) THEN
    ALTER TYPE trigger_status ADD VALUE IF NOT EXISTS 'DRAFT';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trigger_status' AND EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'trigger_status' AND e.enumlabel = 'ADDITIONAL_INFO_REQUIRED'
  )) THEN
    ALTER TYPE trigger_status ADD VALUE IF NOT EXISTS 'ADDITIONAL_INFO_REQUIRED';
  END IF;
END $$;

ALTER TABLE trigger_requests
  ADD COLUMN IF NOT EXISTS request_kind VARCHAR(50) NOT NULL DEFAULT 'medical',
  ADD COLUMN IF NOT EXISTS subject_line VARCHAR(200) NOT NULL DEFAULT 'Trigger request',
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'High',
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS additional_info_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS additional_info_reason TEXT,
  ADD COLUMN IF NOT EXISTS latest_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_action_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS last_action_role VARCHAR(30),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

ALTER TABLE trigger_proofs
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by_role VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_trigger_requests_latest_activity_at ON trigger_requests(latest_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_requests_request_kind ON trigger_requests(request_kind);
CREATE INDEX IF NOT EXISTS idx_trigger_requests_priority ON trigger_requests(priority);
CREATE INDEX IF NOT EXISTS idx_trigger_proofs_request_id_uploaded_at ON trigger_proofs(trigger_request_id, uploaded_at DESC);
