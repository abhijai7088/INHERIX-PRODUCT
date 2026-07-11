ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET must_reset_password = FALSE
WHERE must_reset_password IS NULL;
