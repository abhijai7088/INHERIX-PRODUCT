DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'idx_document_categories_name_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_document_categories_name_unique
      ON document_categories (lower(category_name));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_vaults_status ON vaults(status);

