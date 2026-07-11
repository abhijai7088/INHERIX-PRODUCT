import assert from "node:assert/strict";
import { test } from "node:test";

import { createLogger } from "../dist/config/logger.js";
import { createBackendServer } from "../dist/server.js";
import { createNomineeService } from "../dist/modules/nominee/nominee.service.js";

const testEnv = {
  NODE_ENV: "test",
  PORT: 0,
  API_PREFIX: "/api/v1",
  API_BASE_URL: "http://127.0.0.1:0/api/v1",
  LOG_LEVEL: "silent",
  FRONTEND_ORIGIN: "http://localhost:3000",
  SWAGGER_ENABLED: true,
  TRUST_PROXY: false,
  REQUEST_BODY_LIMIT: "1mb",
  DATABASE_URL: undefined,
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: undefined,
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "30d",
  AUTH_COOKIE_NAME: "inherix_refresh_token",
  AUTH_COOKIE_DOMAIN: undefined,
  AUTH_COOKIE_SECURE: false,
  AUTH_COOKIE_SAME_SITE: "lax",
  S3_BUCKET_NAME: undefined,
  AWS_REGION: undefined,
  AWS_KMS_KEY_ID: undefined,
  AWS_ACCESS_KEY_ID: undefined,
  AWS_SECRET_ACCESS_KEY: undefined,
  AWS_SESSION_TOKEN: undefined,
  EMAIL_PROVIDER: "development",
  EMAIL_FROM: undefined,
  SENDGRID_API_KEY: undefined,
  AWS_SES_REGION: undefined,
};

function createCustomerPrincipal() {
  return {
    user: {
      id: "customer-1",
      email: "customer@example.com",
      fullName: "Customer Owner",
      role: "CUSTOMER",
    },
    session: {
      id: "session-1",
    },
    accessToken: "customer-access",
    authenticatedBy: "access",
  };
}

function createNomineePrincipal() {
  return {
    user: {
      id: "nominee-user-1",
      email: "nominee@example.com",
      fullName: "Nominee User",
      role: "NOMINEE",
    },
    session: {
      id: "session-2",
    },
    accessToken: "nominee-access",
    authenticatedBy: "access",
  };
}

function createMemoryNomineeStore() {
  const nominees = [];
  const auditLogs = [];
  const securityEvents = [];
  const notifications = [];

  const store = {
    nominees,
    auditLogs,
    securityEvents,
    notifications,
    invitationEmail: null,
    async listNominees(customerId) {
      return nominees.filter((nominee) => nominee.customerId === customerId);
    },
    async findNomineeById(nomineeId) {
      return nominees.find((nominee) => nominee.id === nomineeId) ?? null;
    },
    async findNomineeByEmail(customerId, email) {
      return nominees.find(
        (nominee) => nominee.customerId === customerId && nominee.email?.toLowerCase() === email.toLowerCase()
      ) ?? null;
    },
    async findNomineeByInvitationTokenHash(tokenHash) {
      return nominees.find((nominee) => nominee.invitationTokenHash === tokenHash) ?? null;
    },
    async findNomineeByUserId(nomineeUserId) {
      return nominees.find((nominee) => nominee.nomineeUserId === nomineeUserId && nominee.status === "ACTIVE") ?? null;
    },
    async createNominee(input, invitationTokenHash, invitationExpiresAt) {
      const nominee = {
        id: `nominee-${nominees.length + 1}`,
        customerId: input.customerId,
        nomineeUserId: null,
        fullName: input.fullName,
        email: input.email,
        mobile: input.mobile,
        relationship: input.relationship,
        customRelationship: input.customRelationship,
        notes: input.notes,
        status: "INVITED",
        verificationStatus: "PENDING",
        invitationTokenHash,
        invitationExpiresAt: invitationExpiresAt.toISOString(),
        invitedAt: new Date().toISOString(),
        acceptedAt: null,
        removedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        invitationStatus: "SENT",
        assignedCount: 0,
      };
      nominees.unshift(nominee);
      return nominee;
    },
    async updateNominee(nomineeId, values) {
      const nominee = nominees.find((item) => item.id === nomineeId);
      if (!nominee) {
        return null;
      }

      Object.assign(nominee, {
        fullName: values.fullName ?? nominee.fullName,
        email: values.email ?? nominee.email,
        mobile: values.mobile ?? nominee.mobile,
        relationship: values.relationship ?? nominee.relationship,
        customRelationship: values.customRelationship ?? nominee.customRelationship,
        notes: values.notes ?? nominee.notes,
        updatedAt: new Date().toISOString(),
      });

      return nominee;
    },
    async resendInvitation(nomineeId, invitationTokenHash, invitationExpiresAt) {
      const nominee = nominees.find((item) => item.id === nomineeId);
      if (!nominee) {
        return null;
      }

      Object.assign(nominee, {
        invitationTokenHash,
        invitationExpiresAt: invitationExpiresAt.toISOString(),
        invitedAt: new Date().toISOString(),
        status: "INVITED",
        updatedAt: new Date().toISOString(),
      });

      return nominee;
    },
    async acceptInvitation(nomineeId, userId) {
      const nominee = nominees.find((item) => item.id === nomineeId);
      if (!nominee) {
        return null;
      }

      Object.assign(nominee, {
        nomineeUserId: userId,
        status: "ACTIVE",
        acceptedAt: new Date().toISOString(),
        invitationTokenHash: null,
        invitationExpiresAt: null,
        updatedAt: new Date().toISOString(),
        invitationStatus: "ACCEPTED",
      });

      return nominee;
    },
    async removeNominee(nomineeId) {
      const nominee = nominees.find((item) => item.id === nomineeId);
      if (!nominee) {
        return null;
      }

      Object.assign(nominee, {
        status: "REMOVED",
        removedAt: new Date().toISOString(),
        invitationTokenHash: null,
        invitationExpiresAt: null,
        updatedAt: new Date().toISOString(),
        invitationStatus: "REMOVED",
      });

      return nominee;
    },
    async findUserByEmail() {
      return null;
    },
    async findUserById(userId) {
      if (userId === "customer-1") {
        return {
          id: "customer-1",
          fullName: "Customer Owner",
          email: "customer@example.com",
          mobile: null,
          passwordHash: "hash",
          role: "CUSTOMER",
          status: "ACTIVE",
          isEmailVerified: true,
          isMobileVerified: true,
          mfaEnabled: false,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      if (userId === "nominee-user-1") {
        return {
          id: "nominee-user-1",
          fullName: "Nominee User",
          email: "nominee@example.com",
          mobile: null,
          passwordHash: "hash",
          role: "NOMINEE",
          status: "ACTIVE",
          isEmailVerified: true,
          isMobileVerified: true,
          mfaEnabled: false,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return null;
    },
    async updateUser(userId, values) {
      if (userId !== "nominee-user-1") {
        return null;
      }

      return {
        id: "nominee-user-1",
        fullName: "Nominee User",
        email: "nominee@example.com",
        mobile: null,
        passwordHash: "hash",
        role: values.role ?? "NOMINEE",
        status: values.status ?? "ACTIVE",
        isEmailVerified: true,
        isMobileVerified: true,
        mfaEnabled: false,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    async insertAuditLog(entry) {
      auditLogs.push(entry);
    },
    async insertSecurityEvent(entry) {
      securityEvents.push(entry);
    },
    async createNotification(entry) {
      notifications.push(entry);
    },
  };

  return store;
}

function createEmailStub(store) {
  return {
    async sendVerificationEmail() {},
    async sendPasswordResetEmail() {},
    async sendNomineeInvitationEmail(to, nomineeName, inviterName, relationship, invitationUrl) {
      store.invitationEmail = {
        to,
        nomineeName,
        inviterName,
        relationship,
        invitationUrl,
      };
    },
  };
}

async function withServer(dependencies, run) {
  const logger = createLogger("silent");
  const server = createBackendServer(testEnv, logger, dependencies);

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server failed to start.");
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("nominee invite flow creates and lists nominees", async () => {
  const store = createMemoryNomineeStore();
  const emailService = createEmailStub(store);
  const nomineeService = createNomineeService(testEnv, createLogger("silent"), store, store, emailService);

  await withServer(
    {
      nominee: {
        resolveAuthSnapshot: async () => createCustomerPrincipal(),
        nomineeService,
      },
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/v1/nominees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: "Nominee User",
          email: "nominee@example.com",
          mobile: "+91 9999999999",
          relationship: "brother",
          notes: "Trusted family contact.",
        }),
      });

      assert.equal(createResponse.status, 201);
      const createJson = await createResponse.json();
      assert.equal(createJson.success, true);
      assert.equal(createJson.data.nominee.fullName, "Nominee User");
      assert.ok(store.invitationEmail?.invitationUrl.includes("/onboarding/accept-invitation?token="));

      const listResponse = await fetch(`${baseUrl}/api/v1/nominees`);
      assert.equal(listResponse.status, 200);
      const listJson = await listResponse.json();
      assert.equal(listJson.data.nominees.length, 1);
    }
  );
});

test("nominee acceptance binds the invited account and updates the role", async () => {
  const store = createMemoryNomineeStore();
  const emailService = createEmailStub(store);
  const nomineeService = createNomineeService(testEnv, createLogger("silent"), store, store, emailService);

  await withServer(
    {
      nominee: {
        resolveAuthSnapshot: async (request) => {
          const url = new URL(request.url ?? "/", "http://localhost");
          if (url.pathname.endsWith("/accept-invitation") || url.pathname.endsWith("/me")) {
            return {
              ...createNomineePrincipal(),
              accessToken: "nominee-access",
            };
          }

          return createCustomerPrincipal();
        },
        nomineeService,
      },
    },
    async (baseUrl) => {
      const createResponse = await fetch(`${baseUrl}/api/v1/nominees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: "Nominee User",
          email: "nominee@example.com",
          mobile: "+91 9999999999",
          relationship: "brother",
          notes: "Trusted family contact.",
        }),
      });
      assert.equal(createResponse.status, 201);

      const invitationToken = new URL(store.invitationEmail.invitationUrl).searchParams.get("token");
      assert.ok(invitationToken);

      const acceptResponse = await fetch(`${baseUrl}/api/v1/nominees/accept-invitation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: invitationToken }),
      });

      assert.equal(acceptResponse.status, 200);
      const acceptJson = await acceptResponse.json();
      assert.equal(acceptJson.data.nominee.status, "ACTIVE");
      assert.equal(acceptJson.data.nominee.invitationStatus, "ACCEPTED");
      assert.equal(acceptJson.data.nextPath, "/dashboard/released-documents/request");
      assert.equal(store.nominees[0].nomineeUserId, "nominee-user-1");

      const currentNomineeResponse = await fetch(`${baseUrl}/api/v1/nominees/me`, {
        headers: {
          Authorization: "Bearer nominee-access",
        },
      });

      assert.equal(currentNomineeResponse.status, 200);
      const currentNomineeJson = await currentNomineeResponse.json();
      assert.equal(currentNomineeJson.data.nominee.customerName, "Customer Owner");
      assert.equal(currentNomineeJson.data.nominee.fullName, "Nominee User");
    }
  );
});
