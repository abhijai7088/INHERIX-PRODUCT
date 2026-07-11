# PHASE 3 - RBAC and User Roles

## What Changed

Phase 3 adds production-grade backend RBAC enforcement for INHERIX.

- `CUSTOMER`, `NOMINEE`, `VERIFICATION_OFFICER`, `ADMIN`, and `SUPER_ADMIN` roles are supported.
- Permission definitions are database-backed through `permissions` and `role_permissions`.
- Protected RBAC endpoints are enforced server-side.
- Denied access attempts on sensitive RBAC admin flows are audited.
- Nominee scope checks now enforce assignment to a specific customer.
- Customer scope checks now enforce ownership.

## Roles Implemented

- `CUSTOMER`
- `NOMINEE`
- `VERIFICATION_OFFICER`
- `ADMIN`
- `SUPER_ADMIN`

## Permission List

### Customer

- `USER_CREATE_VAULT`
- `USER_VIEW_OWN_VAULT`
- `USER_UPLOAD_DOCUMENT`
- `USER_VIEW_OWN_DOCUMENT`
- `USER_DELETE_OWN_DOCUMENT`
- `USER_MANAGE_NOMINEE`
- `USER_MANAGE_ACCESS_RULE`
- `USER_VIEW_OWN_AUDIT_LOG`

### Nominee

- `NOMINEE_ACCEPT_INVITATION`
- `NOMINEE_RAISE_TRIGGER`
- `NOMINEE_UPLOAD_PROOF`
- `NOMINEE_VIEW_TRIGGER_STATUS`
- `NOMINEE_VIEW_RELEASED_DOCUMENT`
- `NOMINEE_DOWNLOAD_RELEASED_DOCUMENT`

### Verification Officer

- `VERIFICATION_VIEW_ASSIGNED_CASE`
- `VERIFICATION_REVIEW_PROOF`
- `VERIFICATION_REQUEST_MORE_INFO`
- `VERIFICATION_ADD_REMARKS`

### Admin

- `ADMIN_VIEW_TRIGGER_QUEUE`
- `ADMIN_VERIFY_PROOF`
- `ADMIN_APPROVE_TRIGGER`
- `ADMIN_REJECT_TRIGGER`
- `ADMIN_RELEASE_DOCUMENT`
- `ADMIN_VIEW_AUDIT_LOG`
- `ADMIN_VIEW_SECURITY_EVENTS`
- `ADMIN_MANAGE_USERS_LIMITED`

### Super Admin

- `VERIFICATION_VIEW_ASSIGNED_CASE`
- `VERIFICATION_REVIEW_PROOF`
- `VERIFICATION_REQUEST_MORE_INFO`
- `VERIFICATION_ADD_REMARKS`
- `SUPER_ADMIN_MANAGE_ADMINS`
- `SUPER_ADMIN_MANAGE_PERMISSIONS`
- `SUPER_ADMIN_VIEW_SYSTEM_AUDIT`
- `SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS`

## Default Role-Permission Mapping

### CUSTOMER

- `USER_CREATE_VAULT`
- `USER_VIEW_OWN_VAULT`
- `USER_UPLOAD_DOCUMENT`
- `USER_VIEW_OWN_DOCUMENT`
- `USER_DELETE_OWN_DOCUMENT`
- `USER_MANAGE_NOMINEE`
- `USER_MANAGE_ACCESS_RULE`
- `USER_VIEW_OWN_AUDIT_LOG`

### NOMINEE

- `NOMINEE_ACCEPT_INVITATION`
- `NOMINEE_RAISE_TRIGGER`
- `NOMINEE_UPLOAD_PROOF`
- `NOMINEE_VIEW_TRIGGER_STATUS`
- `NOMINEE_VIEW_RELEASED_DOCUMENT`
- `NOMINEE_DOWNLOAD_RELEASED_DOCUMENT`

### VERIFICATION_OFFICER

- `VERIFICATION_VIEW_ASSIGNED_CASE`
- `VERIFICATION_REVIEW_PROOF`
- `VERIFICATION_REQUEST_MORE_INFO`
- `VERIFICATION_ADD_REMARKS`

### ADMIN

- `ADMIN_VIEW_TRIGGER_QUEUE`
- `ADMIN_VERIFY_PROOF`
- `ADMIN_APPROVE_TRIGGER`
- `ADMIN_REJECT_TRIGGER`
- `ADMIN_RELEASE_DOCUMENT`
- `ADMIN_VIEW_AUDIT_LOG`
- `ADMIN_VIEW_SECURITY_EVENTS`
- `ADMIN_MANAGE_USERS_LIMITED`

### SUPER_ADMIN

- `VERIFICATION_VIEW_ASSIGNED_CASE`
- `VERIFICATION_REVIEW_PROOF`
- `VERIFICATION_REQUEST_MORE_INFO`
- `VERIFICATION_ADD_REMARKS`
- All `ADMIN` permissions
- `SUPER_ADMIN_MANAGE_ADMINS`
- `SUPER_ADMIN_MANAGE_PERMISSIONS`
- `SUPER_ADMIN_VIEW_SYSTEM_AUDIT`
- `SUPER_ADMIN_MANAGE_SYSTEM_SETTINGS`

## Ownership and Assignment Rules

- Customers can only access their own vault scope.
- Nominees can only access a customer scope when a nominee assignment exists.
- Nominees cannot browse unreleased vault data.
- Admin and super admin access is limited to the workflow and RBAC management surfaces.
- Verification officers can only inspect assigned verification cases.
- No role can bypass the audit trail.

## Protected Endpoints

- `GET /api/v1/rbac/me`
- `GET /api/v1/rbac/permissions`
- `GET /api/v1/admin/rbac/permissions`
- `POST /api/v1/admin/rbac/role-permissions`
- `GET /api/v1/customer/rbac/check`
- `GET /api/v1/nominee/rbac/check`

## Guard and Policy Usage

The backend uses the RBAC helpers in `backend/src/modules/rbac/`.

Example:

```ts
const permissions = await rbacService.getPrincipalPermissions(principal);
await rbacService.ensurePermissionOrThrow(permissions, "SUPER_ADMIN_MANAGE_PERMISSIONS");
await rbacService.ensureCustomerScopeOrThrow(principal, customerId);
await rbacService.ensureNomineeAssignmentOrThrow(principal, customerId);
```

## Seed Instructions

1. Build the backend:

```bash
npm run backend:build
```

2. Seed permissions and role mappings:

```bash
npm run backend:seed
```

3. Optionally create a bootstrap super admin by setting:

- `RBAC_SEED_SUPER_ADMIN_EMAIL`
- `RBAC_SEED_SUPER_ADMIN_PASSWORD`
- `RBAC_SEED_SUPER_ADMIN_FULL_NAME` optional
- `RBAC_SEED_SUPER_ADMIN_MOBILE` optional

## Test Instructions

Run the backend test suite from `latest-code/`:

```bash
npm run backend:test
```

The RBAC tests cover:

- missing token returns `401`
- customer cannot access admin RBAC data
- nominee cannot access customer scope without assignment
- admin cannot manage super admin permissions
- super admin can manage RBAC permissions
- seed catalog and mappings are created as expected

## Known Limitations

- Phase 3 does not implement the vault upload pipeline, S3 storage, signed URL generation, trigger verification, or document release engine.
- RBAC permissions are now enforced, but the actual business workflows will be wired in later phases.
- Super admin bootstrap is optional and only runs when the seed environment variables are provided.

## Next Phase Dependencies

Phase 4 should add:

- vault creation and vault metadata
- document metadata and encrypted object storage
- signed temporary URLs for document access
- upload and download audit hooks
- customer-scoped document browsing
