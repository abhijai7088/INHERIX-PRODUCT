DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'privacy_request_type') THEN
    CREATE TYPE privacy_request_type AS ENUM ('DATA_EXPORT', 'ACCOUNT_DELETION');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'privacy_request_status') THEN
    CREATE TYPE privacy_request_status AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type privacy_request_type NOT NULL,
  status privacy_request_status NOT NULL DEFAULT 'REQUESTED',
  reason TEXT,
  export_format TEXT,
  export_payload JSONB,
  review_notes TEXT,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_role user_role,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_privacy_requests_updated_at') THEN
    CREATE TRIGGER set_privacy_requests_updated_at
    BEFORE UPDATE ON privacy_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_privacy_requests_user_requested_at ON privacy_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_user_type_status ON privacy_requests(user_id, request_type, status);
