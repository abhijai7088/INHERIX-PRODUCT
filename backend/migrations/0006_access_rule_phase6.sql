DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_rule_release_condition') THEN
    CREATE TYPE access_rule_release_condition AS ENUM (
      'DEATH_EVENT',
      'MEDICAL_INCAPACITY',
      'LEGAL_EVENT',
      'EMERGENCY_ACCESS',
      'OWNER_INACTIVE',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_rule_action') THEN
    CREATE TYPE access_rule_action AS ENUM ('CREATED', 'UPDATED', 'REVOKED', 'DELETED', 'REACTIVATED');
  END IF;
END $$;

ALTER TABLE document_access_rules
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES document_categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS condition_notes TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE document_access_rules
  ALTER COLUMN document_id DROP NOT NULL;

DO $$
DECLARE
  column_type TEXT;
BEGIN
  SELECT data_type
    INTO column_type
    FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'document_access_rules'
     AND column_name = 'release_condition';

  IF column_type = 'text' OR column_type = 'character varying' THEN
    ALTER TABLE document_access_rules
      ALTER COLUMN release_condition TYPE access_rule_release_condition
      USING CASE
        WHEN release_condition IS NULL OR trim(release_condition) = '' THEN 'OTHER'::access_rule_release_condition
        WHEN upper(release_condition) IN ('DEATH_EVENT', 'MEDICAL_INCAPACITY', 'LEGAL_EVENT', 'EMERGENCY_ACCESS', 'OWNER_INACTIVE', 'OTHER')
          THEN upper(release_condition)::access_rule_release_condition
        ELSE 'OTHER'::access_rule_release_condition
      END;
  END IF;

  ALTER TABLE document_access_rules
    ALTER COLUMN release_condition SET DEFAULT 'OTHER'::access_rule_release_condition;
END $$;

ALTER TABLE document_access_rules
  DROP CONSTRAINT IF EXISTS document_access_rules_nominee_id_document_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'document_access_rules_scope_check'
       AND conrelid = 'document_access_rules'::regclass
  ) THEN
    ALTER TABLE document_access_rules
      ADD CONSTRAINT document_access_rules_scope_check
      CHECK (
        (document_id IS NOT NULL AND category_id IS NULL)
        OR
        (document_id IS NULL AND category_id IS NOT NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_rules_active_document_scope
  ON document_access_rules (customer_id, nominee_id, document_id)
  WHERE is_active = TRUE AND deleted_at IS NULL AND document_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_rules_active_category_scope
  ON document_access_rules (customer_id, nominee_id, category_id)
  WHERE is_active = TRUE AND deleted_at IS NULL AND category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_rules_customer_id ON document_access_rules(customer_id);
CREATE INDEX IF NOT EXISTS idx_access_rules_nominee_id ON document_access_rules(nominee_id);
CREATE INDEX IF NOT EXISTS idx_access_rules_document_id ON document_access_rules(document_id);
CREATE INDEX IF NOT EXISTS idx_access_rules_category_id ON document_access_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_access_rules_status ON document_access_rules(is_active, deleted_at);

CREATE TABLE IF NOT EXISTS document_access_rule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_rule_id UUID NOT NULL REFERENCES document_access_rules(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES nominees(id) ON DELETE CASCADE,
  action access_rule_action NOT NULL,
  performed_by UUID REFERENCES users(id),
  performed_role user_role,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_access_rule_history_rule_id ON document_access_rule_history(access_rule_id);
CREATE INDEX IF NOT EXISTS idx_access_rule_history_customer_id ON document_access_rule_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_access_rule_history_created_at ON document_access_rule_history(created_at);
