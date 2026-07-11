CREATE TABLE IF NOT EXISTS profile_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  workflow_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  security_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  release_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  compliance_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  share_contact_with_nominees BOOLEAN NOT NULL DEFAULT FALSE,
  share_activity_with_nominees BOOLEAN NOT NULL DEFAULT FALSE,
  allow_data_exports BOOLEAN NOT NULL DEFAULT TRUE,
  allow_trusted_device_tracking BOOLEAN NOT NULL DEFAULT TRUE,
  last_reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_profile_preferences_updated_at') THEN
    CREATE TRIGGER set_profile_preferences_updated_at
    BEFORE UPDATE ON profile_preferences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profile_preferences_last_reviewed_at ON profile_preferences(last_reviewed_at);

