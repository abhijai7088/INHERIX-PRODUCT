DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_token_purpose') THEN
    CREATE TYPE auth_token_purpose AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'RECOVERY_CODE');
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    INNER JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'auth_token_purpose' AND e.enumlabel = 'RECOVERY_CODE'
  ) THEN
    ALTER TYPE auth_token_purpose ADD VALUE 'RECOVERY_CODE';
  END IF;
END $$;

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS trusted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trust_revoked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trust_label TEXT;

CREATE INDEX IF NOT EXISTS idx_user_sessions_trusted_at ON user_sessions(trusted_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_trust_revoked_at ON user_sessions(trust_revoked_at);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose_created_at ON auth_tokens(user_id, purpose, created_at DESC);
