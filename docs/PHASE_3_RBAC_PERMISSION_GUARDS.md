# Phase 3 - RBAC Permission Guards

## What was built

- A production RBAC catalog for INHERIX roles and permissions
- PostgreSQL seed data for `permissions` and `role_permissions`
- Backend RBAC helpers for role checks, permission checks, and landing-path resolution
- Auth responses now include the authenticated user plus the effective permission list
- Frontend dashboard route protection now respects role and permission boundaries
- Admin-oriented dashboard routes are blocked for non-authorized roles

## RBAC architecture

- The database is the source of truth for role-permission assignments
- The backend resolves a user''s effective permissions from the role mapping
- If seeded rows are missing in a non-production environment, the RBAC service falls back to the locked role catalog so development remains usable
- Permission checks are structured as reusable guard helpers for future vault, nominee, trigger, release, and admin modules

## Permission model

- Customer and nominee users receive only the permissions needed for their own workflow scope
- Admin users receive controlled release, audit, and security visibility without vault-browsing privileges
- Super admin users receive platform governance and RBAC management privileges
- No role gets unrestricted document browsing or automatic release permissions

## Frontend integration

- `proxy.ts` now consults backend-backed session data before allowing access to protected dashboard routes
- Admin, security, governance, audit, backup, and report routes are redirected away from unauthorized users
- Authenticated users continue to land on the closest valid dashboard route for their role

## Database changes

- `backend/migrations/0003_rbac_phase3.sql`

## Environment variables

- No new environment variables were required for Phase 3

## Verification

- `npm run backend:build`
- `npm run backend:test`
- `npm run lint`
- `npm run build`

## Remaining Phase 4 work

- Vault metadata and encrypted document storage
- S3 upload and signed URL delivery
- Document access rules and nominee-scoped release flows
- Trigger request, proof upload, and controlled release enforcement

