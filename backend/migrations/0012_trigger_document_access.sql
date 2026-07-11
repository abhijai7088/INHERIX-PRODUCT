ALTER TABLE trigger_requests
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trigger_requests_document_id ON trigger_requests(document_id);
