# Phase 6 - Access Rule Engine

## Completed

- Added a production access-rule backend module with create, list, detail, update, revoke, reactivate, delete, and admin list endpoints.
- Added rule-history persistence with audited history entries for every sensitive rule mutation.
- Extended the PostgreSQL schema for scoped access rules, rule history, release conditions, and partial unique indexes for active rules.
- Replaced the mock access-sharing experience on the owner-facing nominee access page with real API-backed rule management.
- Replaced the mocked connections access page with a real access-rule register.
- Converted the record share modal into a backend-backed access-rule creator.
- Added regression tests for:
  - rule creation
  - invalid permission combinations
  - ownership violations
  - duplicate active rules
  - lifecycle history
  - admin rule listing

## Production Notes

- Access rules do not grant document access by themselves.
- Documents remain stored outside the database.
- Access to document content still depends on controlled release workflows and signed URLs.
- Sensitive actions create audit log and security event entries.

## Remaining Gaps

- The broader record detail experience still uses existing local dashboard state for non-access metadata.
- Live database migration execution and environment validation were not run in this workspace session.
- E2E coverage for the full release workflow remains a later-phase task.

## API Surface

- `GET /api/v1/access-rules`
- `POST /api/v1/access-rules`
- `GET /api/v1/access-rules/{ruleId}`
- `PUT /api/v1/access-rules/{ruleId}`
- `DELETE /api/v1/access-rules/{ruleId}`
- `POST /api/v1/access-rules/{ruleId}/revoke`
- `POST /api/v1/access-rules/{ruleId}/reactivate`
- `GET /api/v1/admin/access-rules`

