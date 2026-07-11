CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'NOMINEE', 'ADMIN', 'SUPER_ADMIN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DECEASED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
    CREATE TYPE document_status AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nominee_status') THEN
    CREATE TYPE nominee_status AS ENUM ('INVITED', 'ACTIVE', 'REJECTED', 'REMOVED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trigger_status') THEN
    CREATE TYPE trigger_status AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proof_status') THEN
    CREATE TYPE proof_status AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'release_status') THEN
    CREATE TYPE release_status AS ENUM ('PENDING', 'RELEASED', 'REVOKED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'IN_APP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'released_document_action') THEN
    CREATE TYPE released_document_action AS ENUM ('VIEWED', 'DOWNLOADED', 'FAILED_ACCESS');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  mobile VARCHAR(20),
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  status user_status NOT NULL DEFAULT 'ACTIVE',
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  ip_address VARCHAR(100),
  device_info TEXT,
  browser_info TEXT,
  location_info TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (role, permission_id)
);

CREATE TABLE IF NOT EXISTS vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vault_name VARCHAR(150) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES document_categories(id),
  document_title VARCHAR(200) NOT NULL,
  document_description TEXT,
  original_file_name VARCHAR(255),
  encrypted_file_path TEXT NOT NULL,
  file_mime_type VARCHAR(100),
  file_size BIGINT,
  file_hash TEXT,
  encryption_key_ref TEXT,
  status document_status NOT NULL DEFAULT 'ACTIVE',
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS nominees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  mobile VARCHAR(20),
  relationship VARCHAR(100) NOT NULL,
  custom_relationship VARCHAR(100),
  status nominee_status NOT NULL DEFAULT 'INVITED',
  verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  invitation_token TEXT,
  invited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES nominees(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_download BOOLEAN NOT NULL DEFAULT FALSE,
  release_condition TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (nominee_id, document_id)
);

CREATE TABLE IF NOT EXISTS trigger_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES nominees(id) ON DELETE CASCADE,
  requested_by_user_id UUID REFERENCES users(id),
  trigger_type VARCHAR(100) NOT NULL,
  reason TEXT,
  status trigger_status NOT NULL DEFAULT 'PENDING',
  admin_remarks TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trigger_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_request_id UUID NOT NULL REFERENCES trigger_requests(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  proof_type VARCHAR(100) NOT NULL,
  original_file_name VARCHAR(255),
  encrypted_file_path TEXT NOT NULL,
  file_mime_type VARCHAR(100),
  file_size BIGINT,
  file_hash TEXT,
  verification_status proof_status NOT NULL DEFAULT 'UPLOADED',
  admin_remarks TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_request_id UUID NOT NULL REFERENCES trigger_requests(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_request_id UUID NOT NULL REFERENCES trigger_requests(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES nominees(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  released_by UUID REFERENCES users(id),
  release_status release_status NOT NULL DEFAULT 'PENDING',
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_download BOOLEAN NOT NULL DEFAULT FALSE,
  release_notes TEXT,
  released_at TIMESTAMP,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (trigger_request_id, nominee_id, document_id)
);

CREATE TABLE IF NOT EXISTS released_document_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES document_releases(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES nominees(id),
  document_id UUID NOT NULL REFERENCES documents(id),
  action released_document_action NOT NULL,
  ip_address VARCHAR(100),
  device_info TEXT,
  accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  role user_role,
  action VARCHAR(150) NOT NULL,
  module_name VARCHAR(100),
  entity_type VARCHAR(100),
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(100),
  device_info TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_description TEXT,
  ip_address VARCHAR(100),
  device_info TEXT,
  risk_level VARCHAR(50) NOT NULL DEFAULT 'LOW',
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'PENDING',
  read_at TIMESTAMP,
  sent_at TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legacy_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_id UUID REFERENCES nominees(id),
  title VARCHAR(200),
  message TEXT NOT NULL,
  is_release_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  release_condition TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_users_updated_at') THEN
    CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_vaults_updated_at') THEN
    CREATE TRIGGER set_vaults_updated_at
    BEFORE UPDATE ON vaults
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_documents_updated_at') THEN
    CREATE TRIGGER set_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_nominees_updated_at') THEN
    CREATE TRIGGER set_nominees_updated_at
    BEFORE UPDATE ON nominees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_document_access_rules_updated_at') THEN
    CREATE TRIGGER set_document_access_rules_updated_at
    BEFORE UPDATE ON document_access_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_trigger_requests_updated_at') THEN
    CREATE TRIGGER set_trigger_requests_updated_at
    BEFORE UPDATE ON trigger_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_legacy_messages_updated_at') THEN
    CREATE TRIGGER set_legacy_messages_updated_at
    BEFORE UPDATE ON legacy_messages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_vaults_customer_id ON vaults(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_vault_id ON documents(vault_id);
CREATE INDEX IF NOT EXISTS idx_documents_category_id ON documents(category_id);
CREATE INDEX IF NOT EXISTS idx_nominees_customer_id ON nominees(customer_id);
CREATE INDEX IF NOT EXISTS idx_nominees_email ON nominees(email);
CREATE INDEX IF NOT EXISTS idx_trigger_customer_id ON trigger_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_trigger_nominee_id ON trigger_requests(nominee_id);
CREATE INDEX IF NOT EXISTS idx_trigger_status ON trigger_requests(status);
CREATE INDEX IF NOT EXISTS idx_releases_nominee_id ON document_releases(nominee_id);
CREATE INDEX IF NOT EXISTS idx_releases_document_id ON document_releases(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

