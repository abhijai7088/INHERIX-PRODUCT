# INHERIX Backend

Phase 1 backend foundation for the INHERIX production platform.

## What is included
- runtime configuration validation
- structured JSON logging with redaction
- HTTP health, readiness, metadata, and OpenAPI endpoints
- CORS and security headers
- HTTPS enforcement in production
- initial PostgreSQL migration set
- smoke tests for the foundation routes

## Commands
Run from `latest-code/`:

- `npm run backend:build`
- `npm run backend:test`
- `npm run backend:start`

## Environment variables
See [`.env.example`](./.env.example).

For real email delivery during development, set:

- `EMAIL_PROVIDER=gmail`
- `EMAIL_FROM=yourgmailaddress@gmail.com`
- `EMAIL_GMAIL_USER=yourgmailaddress@gmail.com`
- `EMAIL_GMAIL_APP_PASSWORD=your-google-app-password`

Use a Google App Password, not your normal Gmail password.

## Notes
- Production secrets are not hardcoded.
- The backend will refuse to start in production if the required secrets are missing.
- Phase 2 and later will connect the remaining workflow modules, authentication, storage, RBAC, and audit services to these foundations.
