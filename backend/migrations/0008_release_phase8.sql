CREATE INDEX IF NOT EXISTS idx_document_releases_trigger_request_id ON document_releases(trigger_request_id);
CREATE INDEX IF NOT EXISTS idx_document_releases_nominee_id ON document_releases(nominee_id);
CREATE INDEX IF NOT EXISTS idx_document_releases_document_id ON document_releases(document_id);
CREATE INDEX IF NOT EXISTS idx_document_releases_status ON document_releases(release_status);
CREATE INDEX IF NOT EXISTS idx_released_document_access_logs_release_id ON released_document_access_logs(release_id);
CREATE INDEX IF NOT EXISTS idx_released_document_access_logs_nominee_id ON released_document_access_logs(nominee_id);
CREATE INDEX IF NOT EXISTS idx_released_document_access_logs_accessed_at ON released_document_access_logs(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_notes_trigger_request_id ON verification_notes(trigger_request_id);
CREATE INDEX IF NOT EXISTS idx_verification_notes_admin_id ON verification_notes(admin_id);
