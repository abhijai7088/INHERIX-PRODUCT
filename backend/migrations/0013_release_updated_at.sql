ALTER TABLE document_releases
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_document_releases_updated_at'
  ) THEN
    CREATE TRIGGER set_document_releases_updated_at
    BEFORE UPDATE ON document_releases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
