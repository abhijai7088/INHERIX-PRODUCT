ALTER TABLE nominees
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS invitation_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_nominees_invitation_token_hash ON nominees(invitation_token_hash);
CREATE INDEX IF NOT EXISTS idx_nominees_status ON nominees(status);
