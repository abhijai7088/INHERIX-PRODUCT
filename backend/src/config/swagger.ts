import type { AppEnv } from "./env.js";
import { getApiBaseUrl } from "./env.js";

export function createOpenApiDocument(env: AppEnv) {
  const baseUrl = getApiBaseUrl(env);

  return {
    openapi: "3.1.0",
    info: {
      title: "INHERIX Backend API",
      version: "0.1.0",
      description:
        "Production backend foundation for INHERIX. This release includes health, readiness, auth, and production RBAC enforcement endpoints while the remaining business modules are implemented in later phases.",
    },
    servers: [
      {
        url: baseUrl,
        description: `${env.NODE_ENV} environment`,
      },
    ],
    tags: [
      { name: "system", description: "System health and readiness" },
      { name: "auth", description: "Authentication and session management" },
      { name: "rbac", description: "Role, permission, and scope checks" },
      { name: "vault", description: "Vault and document metadata" },
      { name: "nominee", description: "Nominee and access mapping" },
      { name: "access-rule", description: "Access rule management" },
      { name: "trigger", description: "Trigger and proof workflow" },
      { name: "release", description: "Controlled release workflow" },
      { name: "profile", description: "Profile and account settings" },
      { name: "audit", description: "Audit and security visibility" },
      { name: "admin", description: "Administrative control plane" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["system"],
          summary: "Health check",
          responses: {
            200: {
              description: "Backend health summary",
            },
          },
        },
      },
      "/ready": {
        get: {
          tags: ["system"],
          summary: "Readiness check",
          responses: {
            200: {
              description: "Backend readiness summary",
            },
          },
        },
      },
      "/meta": {
        get: {
          tags: ["system"],
          summary: "Runtime metadata",
          responses: {
            200: {
              description: "Runtime metadata",
            },
          },
        },
      },
      "/docs": {
        get: {
          tags: ["system"],
          summary: "OpenAPI document",
          responses: {
            200: {
              description: "OpenAPI document",
            },
          },
        },
      },
      "/auth/register": {
        post: {
          tags: ["auth"],
          summary: "Register a new customer account",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Registration completed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["auth"],
          summary: "Authenticate a user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Login succeeded",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
            202: {
              description: "Privileged MFA challenge required",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      message: { type: "string" },
                      data: {
                        type: "object",
                        properties: {
                          mfaRequired: { type: "boolean" },
                          delivery: { type: "string" },
                          email: { type: "string" },
                          role: { type: "string" },
                          nextPath: { type: "string" },
                        },
                      },
                      timestamp: { type: "string" },
                      requestId: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/auth/mfa/verify": {
        post: {
          tags: ["auth"],
          summary: "Complete a privileged MFA sign-in challenge",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "code"],
                  properties: {
                    email: { type: "string" },
                    code: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "MFA verified",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["auth"],
          summary: "Logout current session",
          responses: {
            200: {
              description: "Logout succeeded",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
          },
        },
      },
      "/auth/refresh-token": {
        post: {
          tags: ["auth"],
          summary: "Rotate the refresh token and issue a new access token",
          responses: {
            200: {
              description: "Token refreshed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
          },
        },
      },
      "/auth/forgot-password": {
        post: {
          tags: ["auth"],
          summary: "Request a password reset link",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ForgotPasswordRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Reset request accepted",
            },
          },
        },
      },
      "/auth/reset-password": {
        post: {
          tags: ["auth"],
          summary: "Complete a password reset",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ResetPasswordRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Password reset completed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
          },
        },
      },
      "/auth/verify-email/request": {
        post: {
          tags: ["auth"],
          summary: "Request a verification email",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VerifyEmailRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Verification request accepted",
            },
          },
        },
      },
      "/auth/verify-email": {
        post: {
          tags: ["auth"],
          summary: "Verify an email address using a one-time token",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VerifyEmailTokenRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Email verified",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["auth"],
          summary: "Get the authenticated user profile",
          responses: {
            200: {
              description: "Current user profile",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
          },
        },
      },
      "/auth/sessions": {
        get: {
          tags: ["auth"],
          summary: "List active sessions",
          responses: {
            200: {
              description: "Active sessions",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
          },
        },
      },
      "/auth/sessions/{sessionId}": {
        delete: {
          tags: ["auth"],
          summary: "Revoke a specific session",
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Session revoked",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AuthSuccess" } },
              },
            },
          },
        },
      },
      "/profile": {
        get: {
          tags: ["profile"],
          summary: "Get the authenticated user's profile snapshot",
          responses: {
            200: {
              description: "Profile snapshot retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/account": {
        put: {
          tags: ["profile"],
          summary: "Update account details",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProfileAccountUpdateRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Account updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/notifications": {
        put: {
          tags: ["profile"],
          summary: "Update notification preferences",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProfileNotificationPreferencesRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Preferences updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/privacy": {
        put: {
          tags: ["profile"],
          summary: "Update privacy preferences",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProfilePrivacyPreferencesRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Privacy preferences updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/privacy/export": {
        post: {
          tags: ["profile"],
          summary: "Request a data export for the authenticated user",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProfilePrivacyExportRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Profile export prepared",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfilePrivacyWorkflowResponse" } },
              },
            },
          },
        },
      },
      "/profile/privacy/deletion-request": {
        post: {
          tags: ["profile"],
          summary: "Request a governed account deletion review",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProfilePrivacyDeletionRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Account deletion request submitted",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfilePrivacyWorkflowResponse" } },
              },
            },
          },
        },
      },
      "/profile/security/change-password": {
        post: {
          tags: ["profile"],
          summary: "Change the authenticated user's password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProfilePasswordChangeRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Password changed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/security/mfa/enable": {
        post: {
          tags: ["profile"],
          summary: "Enable MFA for the authenticated user",
          responses: {
            200: {
              description: "MFA enabled",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/security/mfa/disable": {
        post: {
          tags: ["profile"],
          summary: "Disable MFA for the authenticated user",
          responses: {
            200: {
              description: "MFA disabled",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/security/sessions": {
        get: {
          tags: ["profile"],
          summary: "Get the authenticated user's recent sessions",
          responses: {
            200: {
              description: "Profile snapshot retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/security/sessions/{sessionId}": {
        delete: {
          tags: ["profile"],
          summary: "Revoke one of the user's sessions",
          parameters: [{ name: "sessionId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Session revoked",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/security/sessions/revoke-all": {
        post: {
          tags: ["profile"],
          summary: "Revoke all active sessions for the authenticated user",
          responses: {
            200: {
              description: "All active sessions revoked",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/security/recovery-codes/rotate": {
        post: {
          tags: ["profile"],
          summary: "Rotate MFA recovery codes for the authenticated user",
          responses: {
            200: {
              description: "Recovery codes rotated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileRecoveryCodeRotationResponse" } },
              },
            },
          },
        },
      },
      "/profile/security/trusted-devices/{sessionId}/trust": {
        post: {
          tags: ["profile"],
          summary: "Mark an active session as a trusted device",
          parameters: [{ name: "sessionId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProfileTrustedDeviceTrustRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Trusted device saved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
        delete: {
          tags: ["profile"],
          summary: "Revoke trust for a trusted device",
          parameters: [{ name: "sessionId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Trusted device revoked",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/profile/security/alerts/{eventId}/acknowledge": {
        post: {
          tags: ["profile"],
          summary: "Acknowledge a security alert",
          parameters: [{ name: "eventId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Security alert acknowledged",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ProfileSnapshotResponse" } },
              },
            },
          },
        },
      },
      "/rbac/me": {
        get: {
          tags: ["rbac"],
          summary: "Inspect the authenticated RBAC context",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "RBAC context retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/RbacMeResponse" } },
              },
            },
            401: {
              description: "Authentication is required",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
          },
        },
      },
      "/rbac/permissions": {
        get: {
          tags: ["rbac"],
          summary: "List the current user's permissions and catalog",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Permission catalogue retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/RbacPermissionsResponse" } },
              },
            },
            401: {
              description: "Authentication is required",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
          },
        },
      },
      "/admin/rbac/permissions": {
        get: {
          tags: ["admin", "rbac"],
          summary: "View the RBAC management console",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "RBAC management data retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/RbacAdminPermissionsResponse" } },
              },
            },
            401: {
              description: "Authentication is required",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
            403: {
              description: "Forbidden",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
          },
        },
      },
      "/admin/rbac/role-permissions": {
        post: {
          tags: ["admin", "rbac"],
          summary: "Update the permissions assigned to a role",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RbacRolePermissionUpdateRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Role permissions updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/RbacRolePermissionUpdateResponse" } },
              },
            },
            401: {
              description: "Authentication is required",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
            403: {
              description: "Forbidden",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
          },
        },
      },
      "/admin/settings": {
        get: {
          tags: ["admin"],
          summary: "Get the admin settings snapshot",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Admin settings retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardSuccess" } },
              },
            },
          },
        },
        post: {
          tags: ["admin"],
          summary: "Update persisted admin settings",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["updates"],
                  properties: {
                    updates: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["key", "value"],
                        properties: {
                          key: { type: "string" },
                          value: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Admin settings updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardSuccess" } },
              },
            },
          },
        },
      },
      "/admin/admins": {
        get: {
          tags: ["admin"],
          summary: "List privileged admin accounts",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Admin accounts retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardSuccess" } },
              },
            },
          },
        },
        post: {
          tags: ["admin"],
          summary: "Create a privileged admin account",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["fullName", "email", "role"],
                  properties: {
                    fullName: { type: "string" },
                    email: { type: "string" },
                    mobile: { type: "string" },
                    role: { type: "string", enum: ["ADMIN", "SUPER_ADMIN"] },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Admin account created",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardSuccess" } },
              },
            },
          },
        },
      },
      "/admin/admins/{adminId}": {
        patch: {
          tags: ["admin"],
          summary: "Update a privileged admin account",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "adminId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    fullName: { type: "string" },
                    mobile: { type: "string" },
                    role: { type: "string", enum: ["ADMIN", "SUPER_ADMIN"] },
                    status: { type: "string" },
                    mfaEnabled: { type: "boolean" },
                    isEmailVerified: { type: "boolean" },
                    isMobileVerified: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Admin account updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardSuccess" } },
              },
            },
          },
        },
      },
      "/customer/rbac/check": {
        get: {
          tags: ["rbac"],
          summary: "Validate the owning customer scope",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "customerId",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Customer scope verified",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/RbacScopeResponse" } },
              },
            },
            401: {
              description: "Authentication is required",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
            403: {
              description: "Forbidden",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
          },
        },
      },
      "/nominee/rbac/check": {
        get: {
          tags: ["rbac"],
          summary: "Validate nominee assignment scope",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "customerId",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Nominee assignment verified",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/RbacNomineeScopeResponse" } },
              },
            },
            401: {
              description: "Authentication is required",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
            403: {
              description: "Forbidden",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
          },
        },
      },
      "/nominees": {
        get: {
          tags: ["nominee"],
          summary: "List nominees for the authenticated customer",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Nominees retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/NomineeListResponse" } },
              },
            },
          },
        },
        post: {
          tags: ["nominee"],
          summary: "Invite a nominee and send a controlled access email",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NomineeInviteRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Nominee invited",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/NomineeDetailResponse" } },
              },
            },
          },
        },
      },
      "/nominees/accept-invitation": {
        post: {
          tags: ["nominee"],
          summary: "Accept a nominee invitation using the invitation token",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NomineeAcceptRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Invitation accepted",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/NomineeAcceptResponse" } },
              },
            },
          },
        },
      },
      "/nominees/{nomineeId}": {
        get: {
          tags: ["nominee"],
          summary: "Get nominee details",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "nomineeId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Nominee retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/NomineeDetailResponse" } },
              },
            },
          },
        },
        put: {
          tags: ["nominee"],
          summary: "Update a nominee profile and relationship mapping",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "nomineeId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NomineeUpdateRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Nominee updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/NomineeDetailResponse" } },
              },
            },
          },
        },
        delete: {
          tags: ["nominee"],
          summary: "Remove a nominee and preserve the audit trail",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "nomineeId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Nominee removed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/NomineeDetailResponse" } },
              },
            },
          },
        },
      },
      "/nominees/{nomineeId}/resend-invite": {
        post: {
          tags: ["nominee"],
          summary: "Resend a nominee invitation email",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "nomineeId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Invitation resent",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/NomineeDetailResponse" } },
              },
            },
          },
        },
      },
      "/access-rules": {
        get: {
          tags: ["access-rule"],
          summary: "List the authenticated customer's access rules",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Access rules retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AccessRuleListResponse" } },
              },
            },
          },
        },
        post: {
          tags: ["access-rule"],
          summary: "Create an access rule",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AccessRuleCreateRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Access rule created",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AccessRuleDetailResponse" } },
              },
            },
          },
        },
      },
      "/access-rules/{ruleId}": {
        get: {
          tags: ["access-rule"],
          summary: "Get access rule details and history",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "ruleId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Access rule retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AccessRuleDetailResponse" } },
              },
            },
          },
        },
        put: {
          tags: ["access-rule"],
          summary: "Update an access rule",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "ruleId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AccessRuleUpdateRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Access rule updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AccessRuleDetailResponse" } },
              },
            },
          },
        },
        delete: {
          tags: ["access-rule"],
          summary: "Delete an access rule",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "ruleId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Access rule deleted",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AccessRuleDetailResponse" } },
              },
            },
          },
        },
      },
      "/access-rules/{ruleId}/revoke": {
        post: {
          tags: ["access-rule"],
          summary: "Revoke an access rule",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "ruleId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Access rule revoked",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AccessRuleDetailResponse" } },
              },
            },
          },
        },
      },
      "/access-rules/{ruleId}/reactivate": {
        post: {
          tags: ["access-rule"],
          summary: "Reactivate an access rule",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "ruleId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Access rule reactivated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AccessRuleDetailResponse" } },
              },
            },
          },
        },
      },
      "/admin/access-rules": {
        get: {
          tags: ["access-rule", "admin"],
          summary: "List access rules for administrative review",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Access rules retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/AccessRuleListResponse" } },
              },
            },
          },
        },
      },
      "/document-categories": {
        get: {
          tags: ["vault"],
          summary: "List active document categories",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Document categories retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/DocumentCategoryListResponse" } },
              },
            },
            401: {
              description: "Authentication is required",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
          },
        },
      },
      "/vaults": {
        get: {
          tags: ["vault"],
          summary: "List the authenticated customer's vaults",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Vaults retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/VaultListResponse" } },
              },
            },
            401: {
              description: "Authentication is required",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StandardError" } },
              },
            },
          },
        },
        post: {
          tags: ["vault"],
          summary: "Create a vault for the authenticated customer",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VaultCreateRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Vault created",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/VaultDetailResponse" } },
              },
            },
          },
        },
      },
      "/vaults/{vaultId}": {
        get: {
          tags: ["vault"],
          summary: "Get vault details and its documents",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "vaultId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Vault retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/VaultDetailResponse" } },
              },
            },
          },
        },
        put: {
          tags: ["vault"],
          summary: "Update a vault",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "vaultId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VaultUpdateRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Vault updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/VaultDetailResponse" } },
              },
            },
          },
        },
        delete: {
          tags: ["vault"],
          summary: "Delete a vault and its stored documents",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "vaultId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Vault deleted",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/VaultDetailResponse" } },
              },
            },
          },
        },
      },
      "/documents": {
        get: {
          tags: ["vault"],
          summary: "List the authenticated customer's documents",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "vaultId", in: "query", required: false, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Documents retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/DocumentListResponse" } },
              },
            },
          },
        },
      },
      "/documents/upload": {
        post: {
          tags: ["vault"],
          summary: "Start a secure S3 upload for a document",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DocumentUploadRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Upload initiated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/DocumentUploadResponse" } },
              },
            },
          },
        },
      },
      "/documents/{documentId}": {
        get: {
          tags: ["vault"],
          summary: "Get document metadata",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "documentId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Document retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/DocumentDetailResponse" } },
              },
            },
          },
        },
        put: {
          tags: ["vault"],
          summary: "Update document metadata",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "documentId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DocumentUpdateRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Document updated",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/DocumentDetailResponse" } },
              },
            },
          },
        },
        delete: {
          tags: ["vault"],
          summary: "Delete a document and its encrypted S3 object",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "documentId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Document deleted",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/DocumentDetailResponse" } },
              },
            },
          },
        },
      },
      "/documents/{documentId}/download": {
        get: {
          tags: ["vault"],
          summary: "Generate a signed temporary download URL",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "documentId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Download authorized",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/DocumentDownloadResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests": {
        get: {
          tags: ["trigger"],
          summary: "List trigger requests visible to the authenticated user",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["DRAFT", "PENDING", "UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED", "APPROVED", "REJECTED", "CANCELLED"],
              },
            },
            {
              name: "requestKind",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["death", "medical", "legal", "court-order", "other", "document-access"],
              },
            },
            {
              name: "documentId",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Trigger requests retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerRequestListResponse" } },
              },
            },
          },
        },
        post: {
          tags: ["trigger"],
          summary: "Create a trigger request draft",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TriggerRequestCreateRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Trigger request created",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerRequestDetailResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/document-access/eligible-documents": {
        get: {
          tags: ["trigger"],
          summary: "List eligible documents for the signed-in nominee",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Eligible documents retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerEligibleDocumentListResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/{requestId}": {
        get: {
          tags: ["trigger"],
          summary: "Get trigger request details",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Trigger request retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerRequestDetailResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/{requestId}/submit": {
        post: {
          tags: ["trigger"],
          summary: "Submit a trigger request for review",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Trigger request submitted",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerRequestDetailResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/{requestId}/proofs": {
        get: {
          tags: ["trigger"],
          summary: "List proof records for a trigger request",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Trigger proofs retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerProofListResponse" } },
              },
            },
          },
        },
        post: {
          tags: ["trigger"],
          summary: "Prepare a signed upload for a trigger proof",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TriggerProofUploadRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Proof upload prepared",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerProofUploadResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/{requestId}/proofs/{proofId}/verify": {
        post: {
          tags: ["trigger", "admin"],
          summary: "Verify or reject a trigger proof",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "requestId", in: "path", required: true, schema: { type: "string" } },
            { name: "proofId", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TriggerProofReviewRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Proof reviewed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerProofReviewResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/{requestId}/document/preview": {
        get: {
          tags: ["trigger", "admin"],
          summary: "Issue a short-lived preview URL for the linked customer document",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Requested document preview issued",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerDocumentPreviewResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/{requestId}/more-info": {
        post: {
          tags: ["trigger", "admin"],
          summary: "Request additional information for a trigger request",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TriggerMoreInfoRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Additional information requested",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerRequestDetailResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/{requestId}/approve": {
        post: {
          tags: ["trigger", "admin"],
          summary: "Approve an eligible trigger request",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TriggerApprovalRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Trigger request approved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerRequestDetailResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/{requestId}/reject": {
        post: {
          tags: ["trigger", "admin"],
          summary: "Reject an eligible trigger request",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TriggerApprovalRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Trigger request rejected",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerRequestDetailResponse" } },
              },
            },
          },
        },
      },
      "/trigger-requests/{requestId}/timeline": {
        get: {
          tags: ["trigger"],
          summary: "List trigger request timeline entries",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Trigger timeline retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/TriggerTimelineResponse" } },
              },
            },
          },
        },
      },
      "/releases": {
        get: {
          tags: ["release", "admin"],
          summary: "Load the controlled release queue",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Release queue retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ReleaseQueueResponse" } },
              },
            },
          },
        },
        post: {
          tags: ["release", "admin"],
          summary: "Create or update a selective document release",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReleaseCreateRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Release configured",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ReleaseCreateResponse" } },
              },
            },
          },
        },
      },
      "/releases/{requestId}": {
        get: {
          tags: ["release", "admin"],
          summary: "Inspect an approved trigger request for release eligibility",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "requestId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Release case retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ReleaseCaseResponse" } },
              },
            },
          },
        },
      },
      "/releases/{releaseId}/revoke": {
        post: {
          tags: ["release", "admin"],
          summary: "Revoke a controlled document release",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "releaseId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReleaseRevokeRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Release revoked",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ReleaseDetailResponse" } },
              },
            },
          },
        },
      },
      "/released-documents": {
        get: {
          tags: ["release"],
          summary: "List documents released to the authenticated nominee",
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: "Released documents retrieved",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ReleasedDocumentsResponse" } },
              },
            },
          },
        },
      },
      "/released-documents/{releaseId}/access": {
        post: {
          tags: ["release"],
          summary: "Generate a signed temporary URL for a released document",
          security: [{ bearerAuth: [] }],
          parameters: [{ name: "releaseId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReleaseAccessRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Released document access granted",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ReleaseAccessResponse" } },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        StandardSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Request completed successfully." },
            data: { type: "object" },
            timestamp: { type: "string", format: "date-time" },
            requestId: { type: "string" },
          },
          required: ["success", "message", "data", "timestamp", "requestId"],
        },
        StandardError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Unauthorized access." },
            errorCode: { type: "string", example: "AUTH_401" },
            timestamp: { type: "string", format: "date-time" },
            requestId: { type: "string" },
          },
          required: ["success", "message", "errorCode", "timestamp", "requestId"],
        },
        AuthUser: {
          type: "object",
          properties: {
            id: { type: "string" },
            fullName: { type: "string" },
            email: { type: "string" },
            mobile: { type: ["string", "null"] },
            role: { type: "string", enum: ["CUSTOMER", "NOMINEE", "VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"] },
            status: { type: "string", enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "DECEASED"] },
            isEmailVerified: { type: "boolean" },
            isMobileVerified: { type: "boolean" },
            mfaEnabled: { type: "boolean" },
            lastLoginAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        SessionView: {
          type: "object",
          properties: {
            id: { type: "string" },
            ipAddress: { type: ["string", "null"] },
            deviceInfo: { type: ["string", "null"] },
            browserInfo: { type: ["string", "null"] },
            locationInfo: { type: ["string", "null"] },
            userAgent: { type: ["string", "null"] },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            expiresAt: { type: "string", format: "date-time" },
            revokedAt: { type: ["string", "null"], format: "date-time" },
            rotatedAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        AuthSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                userId: { type: "string" },
                email: { type: "string" },
                role: { type: "string" },
                status: { type: "string" },
                isEmailVerified: { type: "boolean" },
                user: { $ref: "#/components/schemas/AuthUser" },
                permissions: {
                  type: "array",
                  items: { type: "string" },
                },
                accessToken: { type: "string" },
                sessionId: { type: ["string", "null"] },
                nextPath: { type: "string" },
                sessions: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SessionView" },
                },
              },
            },
            timestamp: { type: "string", format: "date-time" },
            requestId: { type: "string" },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["fullName", "email", "mobile", "password"],
          properties: {
            fullName: { type: "string" },
            email: { type: "string" },
            mobile: { type: "string" },
            password: { type: "string" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string" },
            password: { type: "string" },
          },
        },
        ForgotPasswordRequest: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string" },
          },
        },
        ResetPasswordRequest: {
          type: "object",
          required: ["token", "password"],
          properties: {
            token: { type: "string" },
            password: { type: "string" },
          },
        },
        VerifyEmailRequest: {
          type: "object",
          properties: {
            email: { type: "string" },
          },
        },
        VerifyEmailTokenRequest: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
        ProfileSnapshotResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    profile: { $ref: "#/components/schemas/ProfileSnapshot" },
                  },
                },
              },
            },
          ],
        },
        ProfileAccountUpdateRequest: {
          type: "object",
          required: ["fullName"],
          properties: {
            fullName: { type: "string" },
            mobile: { type: ["string", "null"] },
          },
        },
        ProfileNotificationPreferencesRequest: {
          type: "object",
          required: ["emailEnabled", "smsEnabled", "inAppEnabled", "workflowEnabled", "securityEnabled", "releaseEnabled", "complianceEnabled"],
          properties: {
            emailEnabled: { type: "boolean" },
            smsEnabled: { type: "boolean" },
            inAppEnabled: { type: "boolean" },
            workflowEnabled: { type: "boolean" },
            securityEnabled: { type: "boolean" },
            releaseEnabled: { type: "boolean" },
            complianceEnabled: { type: "boolean" },
          },
        },
        ProfilePrivacyPreferencesRequest: {
          type: "object",
          required: ["shareContactWithNominees", "shareActivityWithNominees", "allowDataExports", "allowTrustedDeviceTracking"],
          properties: {
            shareContactWithNominees: { type: "boolean" },
            shareActivityWithNominees: { type: "boolean" },
            allowDataExports: { type: "boolean" },
            allowTrustedDeviceTracking: { type: "boolean" },
          },
        },
        ProfilePrivacyExportRequest: {
          type: "object",
          properties: {
            reason: { type: ["string", "null"] },
          },
        },
        ProfilePrivacyDeletionRequest: {
          type: "object",
          properties: {
            reason: { type: ["string", "null"] },
          },
        },
        ProfilePasswordChangeRequest: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string" },
          },
        },
        ProfileSecurityEvent: {
          type: "object",
          properties: {
            id: { type: "string" },
            eventType: { type: "string" },
            eventDescription: { type: ["string", "null"] },
            riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            isResolved: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            actorName: { type: ["string", "null"] },
            actorEmail: { type: ["string", "null"] },
          },
        },
        ProfileRecoveryCodeSummary: {
          type: "object",
          properties: {
            remainingCount: { type: "integer" },
            lastGeneratedAt: { type: ["string", "null"], format: "date-time" },
            expiresAt: { type: ["string", "null"], format: "date-time" },
            rotationRecommended: { type: "boolean" },
          },
        },
        ProfileTrustedDevice: {
          type: "object",
          properties: {
            id: { type: "string" },
            sessionId: { type: "string" },
            deviceInfo: { type: ["string", "null"] },
            browserInfo: { type: ["string", "null"] },
            locationInfo: { type: ["string", "null"] },
            ipAddress: { type: ["string", "null"] },
            trustedAt: { type: "string", format: "date-time" },
            trustLabel: { type: ["string", "null"] },
            lastSeenAt: { type: "string", format: "date-time" },
            isTrusted: { type: "boolean" },
          },
        },
        ProfileSecuritySession: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            fullName: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["CUSTOMER", "NOMINEE", "VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"] },
            ipAddress: { type: ["string", "null"] },
            deviceInfo: { type: ["string", "null"] },
            browserInfo: { type: ["string", "null"] },
            locationInfo: { type: ["string", "null"] },
            isActive: { type: "boolean" },
            trustedAt: { type: ["string", "null"], format: "date-time" },
            trustRevokedAt: { type: ["string", "null"], format: "date-time" },
            trustLabel: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
            expiresAt: { type: "string", format: "date-time" },
            revokedAt: { type: ["string", "null"], format: "date-time" },
            rotatedAt: { type: ["string", "null"], format: "date-time" },
          },
        },
        ProfileSecurityAlert: {
          type: "object",
          properties: {
            id: { type: "string" },
            eventType: { type: "string" },
            eventDescription: { type: ["string", "null"] },
            riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            isResolved: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            actorName: { type: ["string", "null"] },
            actorEmail: { type: ["string", "null"] },
          },
        },
        ProfileHardeningSummary: {
          type: "object",
          properties: {
            recoveryCodes: { $ref: "#/components/schemas/ProfileRecoveryCodeSummary" },
            trustedDevices: {
              type: "array",
              items: { $ref: "#/components/schemas/ProfileTrustedDevice" },
            },
            suspiciousLogins: {
              type: "array",
              items: { $ref: "#/components/schemas/ProfileSecurityAlert" },
            },
            recentAlerts: {
              type: "array",
              items: { $ref: "#/components/schemas/ProfileSecurityAlert" },
            },
          },
        },
        ProfileSecurityDevice: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            fullName: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["CUSTOMER", "NOMINEE", "VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"] },
            deviceInfo: { type: ["string", "null"] },
            browserInfo: { type: ["string", "null"] },
            locationInfo: { type: ["string", "null"] },
            ipAddress: { type: ["string", "null"] },
            firstSeenAt: { type: "string", format: "date-time" },
            lastLoginAt: { type: "string", format: "date-time" },
            activeSessionCount: { type: "integer" },
            totalSessionCount: { type: "integer" },
            isActive: { type: "boolean" },
          },
        },
        ProfileSnapshot: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["CUSTOMER", "NOMINEE", "VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"] },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", enum: ["account", "security", "notifications", "privacy"] },
                  title: { type: "string" },
                  summary: { type: "string" },
                  visible: { type: "boolean" },
                  reason: { type: "string" },
                },
              },
            },
            account: {
              type: "object",
              properties: {
                id: { type: "string" },
                fullName: { type: "string" },
                email: { type: "string" },
                mobile: { type: ["string", "null"] },
                role: { type: "string" },
                status: { type: "string" },
                isEmailVerified: { type: "boolean" },
                isMobileVerified: { type: "boolean" },
                mfaEnabled: { type: "boolean" },
                initials: { type: "string" },
                lastLoginAt: { type: ["string", "null"], format: "date-time" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
            security: {
              type: "object",
              properties: {
                mfaEnabled: { type: "boolean" },
                activeSessionCount: { type: "integer" },
                totalSessionCount: { type: "integer" },
                recentSessions: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ProfileSecuritySession" },
                },
                sessionHistory: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ProfileSecuritySession" },
                },
                deviceHistory: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ProfileSecurityDevice" },
                },
                loginHistory: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ProfileSecurityEvent" },
                },
                recentSecurityEvents: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ProfileSecurityEvent" },
                },
                trustedDeviceTrackingEnabled: { type: "boolean" },
                passwordLastChangedAt: { type: ["string", "null"], format: "date-time" },
                recoveryCodes: { $ref: "#/components/schemas/ProfileRecoveryCodeSummary" },
                trustedDevices: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ProfileTrustedDevice" },
                },
                suspiciousLogins: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ProfileSecurityAlert" },
                },
                recentAlerts: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ProfileSecurityAlert" },
                },
              },
            },
            hardening: { $ref: "#/components/schemas/ProfileHardeningSummary" },
            notifications: {
              type: "object",
              properties: {
                unreadCount: { type: "integer" },
                lastReviewedAt: { type: ["string", "null"], format: "date-time" },
                preferences: {
                  type: "object",
                  properties: {
                    emailEnabled: { type: "boolean" },
                    smsEnabled: { type: "boolean" },
                    inAppEnabled: { type: "boolean" },
                    workflowEnabled: { type: "boolean" },
                    securityEnabled: { type: "boolean" },
                    releaseEnabled: { type: "boolean" },
                    complianceEnabled: { type: "boolean" },
                  },
                },
              },
            },
            privacy: {
              type: "object",
              properties: {
                requests: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ProfilePrivacyRequest" },
                },
                lastReviewedAt: { type: ["string", "null"], format: "date-time" },
                retentionNote: { type: "string" },
              },
            },
          },
        },
        ProfilePrivacyRequest: {
          type: "object",
          properties: {
            id: { type: "string" },
            requestType: { type: "string", enum: ["DATA_EXPORT", "ACCOUNT_DELETION"] },
            status: { type: "string", enum: ["REQUESTED", "APPROVED", "REJECTED", "COMPLETED"] },
            reason: { type: ["string", "null"] },
            exportFormat: { type: ["string", "null"] },
            exportPayload: { type: ["object", "null"], additionalProperties: true },
            reviewNotes: { type: ["string", "null"] },
            requestedAt: { type: "string", format: "date-time" },
            reviewedAt: { type: ["string", "null"], format: "date-time" },
            completedAt: { type: ["string", "null"], format: "date-time" },
            reviewedByUserId: { type: ["string", "null"] },
            reviewedByRole: { type: ["string", "null"], enum: ["CUSTOMER", "NOMINEE", "VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ProfilePrivacyWorkflowResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    profile: { $ref: "#/components/schemas/ProfileSnapshot" },
                    request: { $ref: "#/components/schemas/ProfilePrivacyRequest" },
                  },
                },
              },
            },
          ],
        },
        ProfileTrustedDeviceTrustRequest: {
          type: "object",
          properties: {
            label: { type: ["string", "null"] },
          },
        },
        ProfileRecoveryCodeRotationResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    profile: { $ref: "#/components/schemas/ProfileSnapshot" },
                    generatedRecoveryCodes: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          ],
        },
        RbacPermission: {
          type: "object",
          properties: {
            id: { type: "string" },
            permissionKey: { type: "string" },
            description: { type: "string" },
            module: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        RbacRolePermission: {
          type: "object",
          properties: {
            role: { type: "string" },
            permissionId: { type: "string" },
            permissionKey: { type: "string" },
            description: { type: ["string", "null"] },
            module: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        RbacMeResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    userId: { type: "string" },
                    role: { type: "string" },
                    email: { type: "string" },
                    sessionId: { type: ["string", "null"] },
                    authenticatedBy: { type: "string" },
                    permissions: {
                      type: "array",
                      items: { type: "string" },
                    },
                    dashboardPath: { type: "string" },
                  },
                },
              },
            },
          ],
        },
        RbacPermissionsResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    userId: { type: "string" },
                    role: { type: "string" },
                    email: { type: "string" },
                    sessionId: { type: ["string", "null"] },
                    permissions: {
                      type: "array",
                      items: { $ref: "#/components/schemas/RbacPermission" },
                    },
                    effectivePermissions: {
                      type: "array",
                      items: { type: "string" },
                    },
                    rolePermissions: {
                      type: "array",
                      items: { $ref: "#/components/schemas/RbacRolePermission" },
                    },
                  },
                },
              },
            },
          ],
        },
        RbacAdminPermissionsResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    permissions: {
                      type: "array",
                      items: { $ref: "#/components/schemas/RbacPermission" },
                    },
                    rolePermissions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          role: { type: "string" },
                          permissions: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        RbacRolePermissionUpdateRequest: {
          type: "object",
          required: ["role", "permissionKeys"],
          properties: {
            role: { type: "string", enum: ["CUSTOMER", "NOMINEE", "VERIFICATION_OFFICER", "ADMIN", "SUPER_ADMIN"] },
            permissionKeys: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        RbacRolePermissionUpdateResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    role: { type: "string" },
                    permissions: {
                      type: "array",
                      items: { $ref: "#/components/schemas/RbacRolePermission" },
                    },
                  },
                },
              },
            },
          ],
        },
        RbacScopeResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    customerId: { type: "string" },
                    role: { type: "string" },
                    allowed: { type: "boolean" },
                  },
                },
              },
            },
          ],
        },
        RbacNomineeScopeResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    customerId: { type: "string" },
                    assignmentId: { type: "string" },
                    nomineeStatus: { type: "string" },
                    allowed: { type: "boolean" },
                  },
                },
              },
            },
          ],
        },
        NomineeRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            customerId: { type: "string" },
            nomineeUserId: { type: ["string", "null"] },
            fullName: { type: "string" },
            email: { type: ["string", "null"] },
            mobile: { type: ["string", "null"] },
            relationship: { type: "string" },
            customRelationship: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            status: { type: "string", enum: ["INVITED", "ACTIVE", "REJECTED", "REMOVED"] },
            verificationStatus: { type: "string" },
            invitationStatus: { type: "string", enum: ["SENT", "PENDING", "ACCEPTED", "REMOVED"] },
            invitedAt: { type: "string", format: "date-time" },
            acceptedAt: { type: ["string", "null"], format: "date-time" },
            removedAt: { type: ["string", "null"], format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            assignedCount: { type: "integer" },
          },
        },
        NomineeInviteRequest: {
          type: "object",
          required: ["fullName", "email", "mobile", "relationship"],
          properties: {
            fullName: { type: "string" },
            email: { type: "string" },
            mobile: { type: "string" },
            relationship: { type: "string" },
            customRelationship: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
          },
        },
        NomineeUpdateRequest: {
          type: "object",
          properties: {
            fullName: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
            mobile: { type: ["string", "null"] },
            relationship: { type: ["string", "null"] },
            customRelationship: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
          },
        },
        NomineeAcceptRequest: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
        NomineeListResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    nominees: {
                      type: "array",
                      items: { $ref: "#/components/schemas/NomineeRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        NomineeDetailResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    nominee: { $ref: "#/components/schemas/NomineeRecord" },
                  },
                },
              },
            },
          ],
        },
        NomineeAcceptResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    nominee: { $ref: "#/components/schemas/NomineeRecord" },
                    nextPath: { type: "string" },
                    accessToken: { type: ["string", "null"] },
                  },
                },
              },
            },
          ],
        },
        AccessRuleRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            customerId: { type: "string" },
            nomineeId: { type: "string" },
            documentId: { type: ["string", "null"] },
            categoryId: { type: ["string", "null"] },
            scopeType: { type: "string", enum: ["DOCUMENT", "CATEGORY"] },
            canView: { type: "boolean" },
            canDownload: { type: "boolean" },
            releaseCondition: { type: "string", enum: ["DEATH_EVENT", "MEDICAL_INCAPACITY", "LEGAL_EVENT", "EMERGENCY_ACCESS", "OWNER_INACTIVE", "OTHER"] },
            conditionNotes: { type: ["string", "null"] },
            isActive: { type: "boolean" },
            revokedAt: { type: ["string", "null"], format: "date-time" },
            deletedAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            nomineeFullName: { type: "string" },
            nomineeEmail: { type: ["string", "null"] },
            documentTitle: { type: ["string", "null"] },
            categoryName: { type: ["string", "null"] },
            status: { type: "string", enum: ["ACTIVE", "REVOKED", "DELETED"] },
          },
        },
        AccessRuleHistoryRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            accessRuleId: { type: "string" },
            action: { type: "string", enum: ["CREATED", "UPDATED", "REVOKED", "DELETED", "REACTIVATED"] },
            customerId: { type: "string" },
            nomineeId: { type: "string" },
            performedBy: { type: ["string", "null"] },
            performedRole: { type: ["string", "null"] },
            oldValue: { type: ["object", "null"], additionalProperties: true },
            newValue: { type: ["object", "null"], additionalProperties: true },
            reason: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        AccessRuleListResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    rules: {
                      type: "array",
                      items: { $ref: "#/components/schemas/AccessRuleRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        AccessRuleDetailResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    rule: { $ref: "#/components/schemas/AccessRuleRecord" },
                    history: {
                      type: "array",
                      items: { $ref: "#/components/schemas/AccessRuleHistoryRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        AccessRuleCreateRequest: {
          type: "object",
          required: ["nomineeId", "releaseCondition"],
          properties: {
            nomineeId: { type: "string" },
            documentId: { type: ["string", "null"] },
            categoryId: { type: ["string", "null"] },
            canView: { type: "boolean" },
            canDownload: { type: "boolean" },
            releaseCondition: { type: "string", enum: ["DEATH_EVENT", "MEDICAL_INCAPACITY", "LEGAL_EVENT", "EMERGENCY_ACCESS", "OWNER_INACTIVE", "OTHER"] },
            conditionNotes: { type: ["string", "null"] },
          },
        },
        AccessRuleUpdateRequest: {
          type: "object",
          properties: {
            nomineeId: { type: ["string", "null"] },
            documentId: { type: ["string", "null"] },
            categoryId: { type: ["string", "null"] },
            canView: { type: ["boolean", "null"] },
            canDownload: { type: ["boolean", "null"] },
            releaseCondition: { type: ["string", "null"], enum: ["DEATH_EVENT", "MEDICAL_INCAPACITY", "LEGAL_EVENT", "EMERGENCY_ACCESS", "OWNER_INACTIVE", "OTHER"] },
            conditionNotes: { type: ["string", "null"] },
          },
        },
        VaultCategory: {
          type: "object",
          properties: {
            id: { type: "string" },
            categoryName: { type: "string" },
            description: { type: ["string", "null"] },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        VaultRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            customerId: { type: "string" },
            vaultName: { type: "string" },
            description: { type: ["string", "null"] },
            status: { type: "string", enum: ["ACTIVE", "LOCKED", "NEEDS_REVIEW"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        DocumentRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            vaultId: { type: "string" },
            customerId: { type: "string" },
            categoryId: { type: "string" },
            documentTitle: { type: "string" },
            documentDescription: { type: ["string", "null"] },
            originalFileName: { type: ["string", "null"] },
            fileMimeType: { type: ["string", "null"] },
            fileSize: { type: ["number", "null"] },
            fileHash: { type: ["string", "null"] },
            encryptionKeyRef: { type: ["string", "null"] },
            status: { type: "string", enum: ["ACTIVE", "ARCHIVED", "DELETED"] },
            uploadedAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            vaultName: { type: "string" },
            categoryName: { type: "string" },
            categoryDescription: { type: ["string", "null"] },
          },
        },
        DocumentCategoryListResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    categories: {
                      type: "array",
                      items: { $ref: "#/components/schemas/VaultCategory" },
                    },
                  },
                },
              },
            },
          ],
        },
        VaultListResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    vaults: {
                      type: "array",
                      items: { $ref: "#/components/schemas/VaultRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        VaultDetailResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    vault: { $ref: "#/components/schemas/VaultRecord" },
                    documents: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DocumentRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        DocumentListResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    documents: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DocumentRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        DocumentDetailResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    document: { $ref: "#/components/schemas/DocumentRecord" },
                  },
                },
              },
            },
          ],
        },
        DocumentUploadRequest: {
          type: "object",
          required: ["vaultId", "categoryId", "documentTitle"],
          properties: {
            vaultId: { type: "string" },
            categoryId: { type: "string" },
            documentTitle: { type: "string" },
            documentDescription: { type: ["string", "null"] },
            originalFileName: { type: ["string", "null"] },
            fileMimeType: { type: ["string", "null"] },
            fileSize: { type: ["number", "null"] },
            fileHash: { type: ["string", "null"] },
          },
        },
        DocumentUploadResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    document: { $ref: "#/components/schemas/DocumentRecord" },
                    upload: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                        expiresAt: { type: "string", format: "date-time" },
                        requiredHeaders: {
                          type: "object",
                          additionalProperties: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        DocumentDownloadResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    document: { $ref: "#/components/schemas/DocumentRecord" },
                    download: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                        expiresAt: { type: "string", format: "date-time" },
                        requiredHeaders: {
                          type: "object",
                          additionalProperties: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        VaultCreateRequest: {
          type: "object",
          required: ["vaultName"],
          properties: {
            vaultName: { type: "string" },
            description: { type: ["string", "null"] },
          },
        },
        VaultUpdateRequest: {
          type: "object",
          properties: {
            vaultName: { type: ["string", "null"] },
            description: { type: ["string", "null"] },
            status: { type: ["string", "null"], enum: ["ACTIVE", "LOCKED", "NEEDS_REVIEW"] },
          },
        },
        DocumentUpdateRequest: {
          type: "object",
          properties: {
            documentTitle: { type: ["string", "null"] },
            documentDescription: { type: ["string", "null"] },
            categoryId: { type: ["string", "null"] },
            status: { type: ["string", "null"], enum: ["ACTIVE", "ARCHIVED", "DELETED"] },
          },
        },
        TriggerRequestRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            customerId: { type: "string" },
            nomineeId: { type: "string" },
            documentId: { type: ["string", "null"] },
            documentTitle: { type: ["string", "null"] },
            nomineeName: { type: "string" },
            nomineeEmail: { type: ["string", "null"] },
            nomineeMobile: { type: ["string", "null"] },
            relationship: { type: "string" },
            customRelationship: { type: ["string", "null"] },
            requestKind: { type: "string", enum: ["death", "medical", "legal", "court-order", "other", "document-access"] },
            subjectLine: { type: "string" },
            summary: { type: "string" },
            priority: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
            status: { type: "string", enum: ["DRAFT", "PENDING", "UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED", "APPROVED", "REJECTED", "CANCELLED"] },
            submittedAt: { type: ["string", "null"], format: "date-time" },
            reviewedAt: { type: ["string", "null"], format: "date-time" },
            resolvedAt: { type: ["string", "null"], format: "date-time" },
            cancelledAt: { type: ["string", "null"], format: "date-time" },
            additionalInfoRequestedAt: { type: ["string", "null"], format: "date-time" },
            additionalInfoReason: { type: ["string", "null"] },
            adminDecisionNote: { type: ["string", "null"] },
            latestActivityAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            proofCount: { type: "integer" },
            latestProofId: { type: ["string", "null"] },
            requestedByUserId: { type: ["string", "null"] },
            lastActionBy: { type: ["string", "null"] },
            lastActionRole: { type: "string" },
          },
        },
        TriggerEligibleDocumentRecord: {
          type: "object",
          properties: {
            documentId: { type: "string" },
            documentTitle: { type: "string" },
            fileName: { type: ["string", "null"] },
            fileType: { type: ["string", "null"] },
            fileSize: { type: ["number", "null"] },
            categoryId: { type: "string" },
            categoryName: { type: "string" },
            canView: { type: "boolean" },
            canDownload: { type: "boolean" },
            releaseCondition: { type: ["string", "null"] },
            conditionNotes: { type: ["string", "null"] },
            requestId: { type: ["string", "null"] },
            requestStatus: { type: ["string", "null"], enum: ["DRAFT", "PENDING", "UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED", "APPROVED", "REJECTED", "CANCELLED"] },
            requestKind: { type: ["string", "null"], enum: ["death", "medical", "legal", "court-order", "other", "document-access"] },
            proofCount: { type: "integer" },
            latestProofStatus: { type: ["string", "null"], enum: ["UPLOADED", "VERIFIED", "REJECTED"] },
            latestProofAt: { type: ["string", "null"], format: "date-time" },
            releaseId: { type: ["string", "null"] },
            releaseStatus: { type: ["string", "null"], enum: ["PENDING", "RELEASED", "REVOKED"] },
            releaseNotes: { type: ["string", "null"] },
            releasedAt: { type: ["string", "null"], format: "date-time" },
            revokedAt: { type: ["string", "null"], format: "date-time" },
            latestActivityAt: { type: "string", format: "date-time" },
          },
        },
        TriggerProofRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            requestId: { type: "string" },
            fileName: { type: "string" },
            fileType: { type: "string" },
            fileSize: { type: "number" },
            fileHash: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            uploadedBy: { type: ["string", "null"] },
            uploadedByRole: { type: "string" },
            verificationStatus: { type: "string", enum: ["UPLOADED", "VERIFIED", "REJECTED"] },
            adminRemarks: { type: ["string", "null"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        TriggerProofReviewRequest: {
          type: "object",
          required: ["verificationStatus"],
          properties: {
            verificationStatus: { type: "string", enum: ["VERIFIED", "REJECTED"] },
            adminRemarks: { type: ["string", "null"] },
          },
        },
        TriggerProofReviewResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    request: { $ref: "#/components/schemas/TriggerRequestRecord" },
                    proof: { $ref: "#/components/schemas/TriggerProofRecord" },
                  },
                },
              },
            },
          ],
        },
        TriggerDocumentPreviewResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    document: {
                      type: "object",
                      properties: {
                        documentId: { type: "string" },
                        documentTitle: { type: "string" },
                        fileName: { type: ["string", "null"] },
                        fileType: { type: ["string", "null"] },
                        fileSize: { type: ["number", "null"] },
                      },
                    },
                    preview: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                        expiresAt: { type: "string", format: "date-time" },
                        requiredHeaders: { type: "object", additionalProperties: { type: "string" } },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        TriggerMoreInfoRequest: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: { type: "string" },
          },
        },
        TriggerApprovalRequest: {
          type: "object",
          properties: {
            adminRemarks: { type: ["string", "null"] },
          },
        },
        TriggerTimelineRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            requestId: { type: "string" },
            action: { type: "string" },
            status: { type: "string", enum: ["DRAFT", "PENDING", "UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED", "APPROVED", "REJECTED", "CANCELLED"] },
            actorName: { type: "string" },
            actorRole: { type: "string" },
            summary: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        TriggerRequestCreateRequest: {
          type: "object",
          required: ["requestKind", "subjectLine", "summary", "priority"],
          properties: {
            nomineeId: { type: ["string", "null"] },
            documentId: { type: ["string", "null"] },
            requestKind: { type: "string", enum: ["death", "medical", "legal", "court-order", "other", "document-access"] },
            subjectLine: { type: "string" },
            summary: { type: "string" },
            priority: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
          },
        },
        TriggerProofUploadRequest: {
          type: "object",
          required: ["fileName", "fileType", "fileSize"],
          properties: {
            fileName: { type: "string" },
            fileType: { type: "string" },
            fileSize: { type: "number" },
            fileHash: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
          },
        },
        TriggerProofUploadResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    proof: { $ref: "#/components/schemas/TriggerProofRecord" },
                    upload: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                        expiresAt: { type: "string", format: "date-time" },
                        requiredHeaders: { type: "object", additionalProperties: { type: "string" } },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        TriggerRequestListResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    requests: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TriggerRequestRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        TriggerRequestDetailResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    request: { $ref: "#/components/schemas/TriggerRequestRecord" },
                    proofs: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TriggerProofRecord" },
                    },
                    timeline: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TriggerTimelineRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        TriggerEligibleDocumentListResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    documents: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TriggerEligibleDocumentRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        TriggerProofListResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    proofs: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TriggerProofRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        TriggerTimelineResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    timeline: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TriggerTimelineRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        ReleaseRequestRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            customerId: { type: "string" },
            nomineeId: { type: "string" },
            nomineeUserId: { type: ["string", "null"] },
            nomineeName: { type: "string" },
            nomineeEmail: { type: ["string", "null"] },
            relationship: { type: "string" },
            customRelationship: { type: ["string", "null"] },
            requestKind: { type: "string", enum: ["death", "medical", "legal", "court-order", "other"] },
            subjectLine: { type: "string" },
            summary: { type: "string" },
            priority: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
            status: { type: "string", enum: ["DRAFT", "PENDING", "UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED", "APPROVED", "REJECTED", "CANCELLED"] },
            reviewedAt: { type: ["string", "null"], format: "date-time" },
            resolvedAt: { type: ["string", "null"], format: "date-time" },
            latestActivityAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ReleaseDocumentCandidate: {
          type: "object",
          properties: {
            documentId: { type: "string" },
            documentTitle: { type: "string" },
            fileName: { type: ["string", "null"] },
            fileType: { type: ["string", "null"] },
            fileSize: { type: ["number", "null"] },
            categoryId: { type: "string" },
            categoryName: { type: "string" },
            canView: { type: "boolean" },
            canDownload: { type: "boolean" },
            releaseCondition: { type: ["string", "null"] },
            conditionNotes: { type: ["string", "null"] },
            releaseId: { type: ["string", "null"] },
            releaseStatus: { type: "string", enum: ["PENDING", "RELEASED", "REVOKED"] },
            releaseNotes: { type: ["string", "null"] },
            releasedAt: { type: ["string", "null"], format: "date-time" },
            revokedAt: { type: ["string", "null"], format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ReleaseRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            triggerRequestId: { type: "string" },
            customerId: { type: "string" },
            nomineeId: { type: "string" },
            nomineeName: { type: "string" },
            nomineeUserId: { type: ["string", "null"] },
            documentId: { type: "string" },
            documentTitle: { type: "string" },
            fileName: { type: ["string", "null"] },
            fileType: { type: ["string", "null"] },
            fileSize: { type: ["number", "null"] },
            categoryId: { type: "string" },
            categoryName: { type: "string" },
            canView: { type: "boolean" },
            canDownload: { type: "boolean" },
            releaseStatus: { type: "string", enum: ["PENDING", "RELEASED", "REVOKED"] },
            releaseNotes: { type: ["string", "null"] },
            releasedBy: { type: ["string", "null"] },
            releasedAt: { type: ["string", "null"], format: "date-time" },
            revokedAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ReleasedDocumentAccessLogRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            releaseId: { type: "string" },
            triggerRequestId: { type: "string" },
            customerId: { type: "string" },
            nomineeId: { type: "string" },
            documentId: { type: "string" },
            documentTitle: { type: "string" },
            action: { type: "string", enum: ["VIEWED", "DOWNLOADED", "FAILED_ACCESS"] },
            actorName: { type: ["string", "null"] },
            ipAddress: { type: ["string", "null"] },
            deviceInfo: { type: ["string", "null"] },
            accessedAt: { type: "string", format: "date-time" },
          },
        },
        ReleaseNotificationRecord: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            title: { type: "string" },
            message: { type: "string" },
            channel: { type: "string", enum: ["EMAIL", "SMS", "WHATSAPP", "IN_APP"] },
            status: { type: "string", enum: ["PENDING", "SENT", "FAILED"] },
            readAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ReleaseQueueSummary: {
          type: "object",
          properties: {
            request: { $ref: "#/components/schemas/ReleaseRequestRecord" },
            eligibleDocumentCount: { type: "integer" },
            releasedDocumentCount: { type: "integer" },
            verifiedProofCount: { type: "integer" },
          },
        },
        ReleaseQueueResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    requests: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReleaseQueueSummary" },
                    },
                    notifications: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReleaseNotificationRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        ReleaseCaseResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    request: { $ref: "#/components/schemas/ReleaseRequestRecord" },
                    documents: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReleaseDocumentCandidate" },
                    },
                    releases: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReleaseRecord" },
                    },
                    proofs: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TriggerProofRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        ReleaseCreateRequest: {
          type: "object",
          required: ["triggerRequestId", "documentId"],
          properties: {
            triggerRequestId: { type: "string" },
            documentId: { type: "string" },
            canView: { type: "boolean" },
            canDownload: { type: "boolean" },
            releaseNotes: { type: ["string", "null"] },
          },
        },
        ReleaseCreateResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    request: { $ref: "#/components/schemas/ReleaseRequestRecord" },
                    release: { $ref: "#/components/schemas/ReleaseRecord" },
                  },
                },
              },
            },
          ],
        },
        ReleaseDetailResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    release: { $ref: "#/components/schemas/ReleaseRecord" },
                  },
                },
              },
            },
          ],
        },
        ReleaseRevokeRequest: {
          type: "object",
          properties: {
            notes: { type: ["string", "null"] },
          },
        },
        ReleasedDocumentsResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    releases: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReleaseRecord" },
                    },
                    notifications: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReleaseNotificationRecord" },
                    },
                    accessLogs: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReleasedDocumentAccessLogRecord" },
                    },
                  },
                },
              },
            },
          ],
        },
        ReleaseAccessRequest: {
          type: "object",
          required: ["action"],
          properties: {
            action: { type: "string", enum: ["view", "download"] },
          },
        },
        ReleaseAccessResponse: {
          allOf: [
            { $ref: "#/components/schemas/StandardSuccess" },
            {
              type: "object",
              properties: {
                data: {
                  type: "object",
                  properties: {
                    release: { $ref: "#/components/schemas/ReleaseRecord" },
                    download: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                        expiresAt: { type: "string", format: "date-time" },
                        requiredHeaders: { type: "object", additionalProperties: { type: "string" } },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  };
}
