DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_token_purpose')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum e
       INNER JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'auth_token_purpose'
         AND e.enumlabel = 'MFA_CHALLENGE'
     ) THEN
    ALTER TYPE auth_token_purpose ADD VALUE 'MFA_CHALLENGE';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(120) UNIQUE NOT NULL,
  group_name VARCHAR(120) NOT NULL,
  label VARCHAR(160) NOT NULL,
  description TEXT,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  editable_by user_role NOT NULL DEFAULT 'SUPER_ADMIN',
  sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  source VARCHAR(120) NOT NULL DEFAULT 'database',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_platform_settings_updated_at') THEN
    CREATE TRIGGER set_platform_settings_updated_at
    BEFORE UPDATE ON platform_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_platform_settings_group_name ON platform_settings(group_name);

INSERT INTO platform_settings (setting_key, group_name, label, description, value, editable_by, sensitive, source)
VALUES
  (
    'platform_name',
    'Platform identity',
    'Platform name',
    'Visible in headers, notifications and exports.',
    '{"value":"INHERIX"}'::jsonb,
    'SUPER_ADMIN',
    FALSE,
    'seed'
  ),
  (
    'support_email',
    'Platform identity',
    'Support email',
    'Primary support mailbox used in admin contact surfaces.',
    '{"value":"support@inherix.local"}'::jsonb,
    'SUPER_ADMIN',
    TRUE,
    'seed'
  ),
  (
    'maintenance_mode',
    'System behavior',
    'Maintenance mode',
    'When enabled, non-privileged routes can be constrained by the application shell.',
    '{"value":false}'::jsonb,
    'SUPER_ADMIN',
    TRUE,
    'seed'
  ),
  (
    'privileged_mfa_enforced',
    'Security',
    'Privileged MFA enforcement',
    'Require privileged roles to complete the second login step.',
    '{"value":true}'::jsonb,
    'SUPER_ADMIN',
    TRUE,
    'seed'
  ),
  (
    'notification_from_name',
    'Notifications',
    'Notification sender name',
    'Displayed on security and workflow notifications.',
    '{"value":"INHERIX Operations"}'::jsonb,
    'SUPER_ADMIN',
    FALSE,
    'seed'
  ),
  (
    'session_idle_timeout_minutes',
    'Security',
    'Session idle timeout',
    'Operational guidance for session timeout in minutes.',
    '{"value":30}'::jsonb,
    'SUPER_ADMIN',
    FALSE,
    'seed'
  )
ON CONFLICT (setting_key) DO NOTHING;
