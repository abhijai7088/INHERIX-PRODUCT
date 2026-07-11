# Phase 9 QA Test Plan

## Purpose
Validate that the INHERIX MVP works correctly, securely, and reliably before staging signoff and production launch.

## Scope
This phase verifies existing functionality only:
- authentication
- vault and record handling
- nominee management
- trigger workflow
- proof upload
- admin verification
- selective release
- released document access
- audit trail
- notifications
- security and RBAC
- admin / governance / backup / reporting surfaces
- deployment readiness

## Test Approach
- End-to-end workflows first
- Positive and negative cases for every critical flow
- Role-based access checks on every sensitive page and action
- Build and runtime validation in the local environment
- Staging smoke test sequence before UAT
- Production readiness review after staging signoff

## Environments
- Local development
- Staging
- Production-ready build artifact

## Entry Criteria
- Code is merged and buildable
- Required env vars are documented
- No unresolved critical defects
- Deployment target and rollback path are known

## Exit Criteria
- Critical workflows pass
- Unauthorized access is blocked
- Sensitive actions are audited
- Staging smoke tests pass
- UAT signoff is captured
- Production launch checklist is complete
- Rollback plan is documented and executable

## Execution Order
1. Authentication and session checks
2. Vault and record checks
3. Nominee and access-rule checks
4. Trigger and proof workflow checks
5. Admin verification and release checks
6. Audit, notification, and security checks
7. Admin / backup / governance / reporting checks
8. Build, staging, and production readiness checks

## Notes
- Document content, secrets, tokens, encryption keys, and raw credentials must never appear in test artifacts.
- Any failure in RBAC, release gating, or audit logging is a release blocker.

