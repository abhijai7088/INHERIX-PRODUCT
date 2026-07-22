import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppEnv } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { createAuthService } from "../auth/auth.service.js";
import { createPostgresAuthStore } from "../auth/auth.store.js";
import type { AuthRequestContext } from "../auth/types.js";
import { createPostgresAccessRuleStore } from "../access-rule/access-rule.store.js";
import { getPool } from "../../db/pool.js";
import { HttpError, buildErrorResponse, buildSuccessResponse, readJsonBody, writeJson } from "../../utils/http.js";
import { getLocationInfo, getRequestIp, getUserAgent, parseClientInfo } from "../../utils/request-meta.js";
import { createTriggerService, type TriggerService } from "./trigger.service.js";
import { createPostgresTriggerStore } from "./trigger.store.js";
import { createPostgresVaultStore } from "../vault/vault.store.js";
import { createPostgresReleaseStore } from "../release/release.store.js";

type RouteContext = {
  env: AppEnv;
  logger: Logger;
  requestId: string;
};

export type TriggerDependencies = {
  resolveAuthSnapshot?: (request: IncomingMessage, context: AuthRequestContext) => Promise<{
    user: { id: string; email: string; role: "CUSTOMER" | "NOMINEE" | "VERIFICATION_OFFICER" | "ADMIN" | "SUPER_ADMIN"; fullName?: string };
    session: { id: string } | null;
    accessToken: string;
    authenticatedBy: "access" | "refresh";
  } | null>;
  triggerService?: TriggerService;
};

function buildError(message: string, errorCode: string, requestId: string) {
  return buildErrorResponse(message, errorCode, requestId);
}

function toRequestContext(request: IncomingMessage, requestId: string): AuthRequestContext {
  const userAgent = getUserAgent(request);
  const { browserInfo, deviceInfo } = parseClientInfo(userAgent);

  return {
    requestId,
    ipAddress: getRequestIp(request),
    userAgent,
    browserInfo,
    deviceInfo,
    locationInfo: getLocationInfo(request),
  };
}

async function resolvePrincipal(
  request: IncomingMessage,
  context: AuthRequestContext,
  routeContext: RouteContext,
  dependencies?: TriggerDependencies
) {
  if (dependencies?.resolveAuthSnapshot) {
    return dependencies.resolveAuthSnapshot(request, context);
  }

  const auth = createAuthService(routeContext.env, routeContext.logger);
  return auth.getAuthSnapshot(request, context);
}

function getTriggerService(routeContext: RouteContext, dependencies?: TriggerDependencies) {
  if (dependencies?.triggerService) {
    return dependencies.triggerService;
  }

  const pool = getPool(routeContext.env);
  const store = createPostgresTriggerStore(pool);
  const authStore = createPostgresAuthStore(pool);
  const accessRuleStore = createPostgresAccessRuleStore(pool);
  const vaultStore = createPostgresVaultStore(pool);
  const releaseStore = createPostgresReleaseStore(pool);
  return createTriggerService(routeContext.env, routeContext.logger, {
    ...store,
    ...authStore,
    ...accessRuleStore,
    ...vaultStore,
    findReleaseByComposite: releaseStore.findReleaseByComposite.bind(releaseStore),
    findDocumentById: vaultStore.findDocumentById.bind(vaultStore),
    upsertRelease: releaseStore.upsertRelease.bind(releaseStore),
  });
}

function parseRequestBody(body: Record<string, unknown>) {
  return {
    nomineeId: typeof body.nomineeId === "string" ? body.nomineeId.trim() : null,
    documentId: typeof body.documentId === "string" ? body.documentId.trim() : null,
    requestKind: typeof body.requestKind === "string" ? body.requestKind.trim() : "",
    subjectLine: typeof body.subjectLine === "string" ? body.subjectLine.trim() : "",
    summary: typeof body.summary === "string" ? body.summary.trim() : "",
    priority: typeof body.priority === "string" ? body.priority.trim() : "",
  };
}

function parseProofBody(body: Record<string, unknown>) {
  return {
    fileName: typeof body.fileName === "string" ? body.fileName.trim() : "",
    fileType: typeof body.fileType === "string" ? body.fileType.trim() : "",
    fileSize: typeof body.fileSize === "number" && Number.isFinite(body.fileSize) ? body.fileSize : 0,
    fileHash: typeof body.fileHash === "string" ? body.fileHash.trim() : null,
    notes: typeof body.notes === "string" ? body.notes.trim() : null,
  };
}

function parseReviewBody(body: Record<string, unknown>) {
  return {
    adminRemarks: typeof body.adminRemarks === "string" ? body.adminRemarks.trim() : null,
    reason: typeof body.reason === "string" ? body.reason.trim() : "",
    verificationStatus:
      body.verificationStatus === "VERIFIED" || body.verificationStatus === "REJECTED"
        ? body.verificationStatus
        : "",
  };
}

function parseStatusFilter(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (
    normalized === "DRAFT" ||
    normalized === "PENDING" ||
    normalized === "UNDER_REVIEW" ||
    normalized === "ADDITIONAL_INFO_REQUIRED" ||
    normalized === "APPROVED" ||
    normalized === "REJECTED" ||
    normalized === "CANCELLED"
  ) {
    return normalized as
      | "DRAFT"
      | "PENDING"
      | "UNDER_REVIEW"
      | "ADDITIONAL_INFO_REQUIRED"
      | "APPROVED"
      | "REJECTED"
      | "CANCELLED";
  }

  return null;
}

function parseRequestKindFilter(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (
    normalized === "death" ||
    normalized === "medical" ||
    normalized === "legal" ||
    normalized === "court-order" ||
    normalized === "other" ||
    normalized === "document-access"
  ) {
    return normalized;
  }

  return null;
}

export async function handleTriggerRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RouteContext,
  routePath: string,
  dependencies?: TriggerDependencies
) {
  const requestContext = toRequestContext(request, context.requestId);
  const principal = await resolvePrincipal(request, requestContext, context, dependencies);
  const service = getTriggerService(context, dependencies);
  const url = new URL(request.url ?? "/", "http://localhost");

  if (!principal) {
    writeJson(response, 401, buildError("Authentication is required.", "UNAUTHORIZED", context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/trigger-requests") {
    const requests = await service.listTriggerRequests(principal, {
      status: parseStatusFilter(url.searchParams.get("status")),
      requestKind: parseRequestKindFilter(url.searchParams.get("requestKind")),
      documentId: url.searchParams.get("documentId"),
    });

    writeJson(response, 200, buildSuccessResponse("Trigger requests retrieved.", { requests }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/trigger-requests/document-access/eligible-documents") {
    const documents = await service.listEligibleDocuments(principal);
    writeJson(response, 200, buildSuccessResponse("Eligible documents retrieved.", { documents }, context.requestId));
    return;
  }

  if (
    request.method === "GET" &&
    routePath.startsWith("/trigger-requests/") &&
    routePath.endsWith("/document/preview")
  ) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/document/preview".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const result = await service.getTriggerRequestedDocumentPreview(principal, requestId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Requested document preview issued.", result, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath === "/trigger-requests") {
    const body = parseRequestBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    if (!body.requestKind || !body.subjectLine || !body.summary || !body.priority) {
      throw new HttpError(400, "VALIDATION_ERROR", "requestKind, subjectLine, summary, and priority are required.");
    }

    const requestRecord = await service.createTriggerRequest(
      principal,
      {
        nomineeId: body.nomineeId,
        requestKind: body.requestKind as
          | "death"
          | "medical"
          | "legal"
          | "court-order"
          | "other"
          | "document-access",
        subjectLine: body.subjectLine,
        summary: body.summary,
        priority: body.priority as "Low" | "Medium" | "High" | "Critical",
        documentId: body.documentId,
      },
      requestContext
    );

    writeJson(response, 201, buildSuccessResponse("Trigger request created.", { request: requestRecord }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/timeline")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/timeline".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const timeline = await service.getTriggerRequestTimeline(principal, requestId);
    writeJson(response, 200, buildSuccessResponse("Trigger timeline retrieved.", { timeline }, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/proofs")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/proofs".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const proofs = await service.listTriggerProofs(principal, requestId);
    writeJson(response, 200, buildSuccessResponse("Trigger proofs retrieved.", { proofs }, context.requestId));
    return;
  }

  if (
    request.method === "GET" &&
    routePath.startsWith("/trigger-requests/") &&
    routePath.includes("/proofs/") &&
    routePath.endsWith("/download")
  ) {
    const [requestSegment, proofSegment] = routePath
      .slice("/trigger-requests/".length, -"/download".length)
      .split("/proofs/");
    const requestId = requestSegment?.trim();
    const proofId = proofSegment?.trim();
    if (!requestId || !proofId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    context.logger.debug("Trigger proof download requested", {
      userId: principal.user.id,
      role: principal.user.role,
      requestId,
      proofId,
    });

    const result = await service.getTriggerProofDownload(principal, requestId, proofId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Trigger proof download issued.", result, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/submit")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/submit".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const requestRecord = await service.submitTriggerRequest(principal, requestId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Trigger request submitted.", { request: requestRecord }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/proofs")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/proofs".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseProofBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    if (!body.fileName || !body.fileType || !body.fileSize) {
      throw new HttpError(400, "VALIDATION_ERROR", "fileName, fileType, and fileSize are required.");
    }

    const result = await service.createProofUpload(
      principal,
      {
        requestId,
        fileName: body.fileName,
        fileType: body.fileType,
        fileSize: body.fileSize,
        fileHash: body.fileHash,
        notes: body.notes,
      },
      requestContext
    );

    writeJson(response, 201, buildSuccessResponse("Trigger proof upload prepared.", result, context.requestId));
    return;
  }

  if (
    request.method === "DELETE" &&
    routePath.startsWith("/trigger-requests/") &&
    routePath.includes("/proofs/")
  ) {
    const [requestSegment, proofSegment] = routePath
      .slice("/trigger-requests/".length)
      .split("/proofs/");
    const requestId = requestSegment?.trim();
    const proofId = proofSegment?.trim();
    if (!requestId || !proofId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const result = await service.deleteUnreviewedTriggerProof(principal, requestId, proofId, requestContext);
    writeJson(response, 200, buildSuccessResponse("Trigger proof upload cancelled.", { request: result }, context.requestId));
    return;
  }

  if (
    request.method === "POST" &&
    routePath.startsWith("/trigger-requests/") &&
    routePath.includes("/proofs/") &&
    routePath.endsWith("/verify")
  ) {
    const [requestSegment, proofSegment] = routePath
      .slice("/trigger-requests/".length, -"/verify".length)
      .split("/proofs/");
    const requestId = requestSegment?.trim();
    const proofId = proofSegment?.trim();
    if (!requestId || !proofId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseReviewBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    if (!body.verificationStatus) {
      throw new HttpError(400, "VALIDATION_ERROR", "verificationStatus is required.");
    }

    const result = await service.verifyTriggerProof(
      principal,
      requestId,
      proofId,
      {
        verificationStatus: body.verificationStatus as "VERIFIED" | "REJECTED",
        adminRemarks: body.adminRemarks,
      },
      requestContext
    );

    writeJson(response, 200, buildSuccessResponse("Trigger proof reviewed.", result, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/more-info")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/more-info".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseReviewBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    if (!body.reason) {
      throw new HttpError(400, "VALIDATION_ERROR", "reason is required.");
    }

    const result = await service.requestTriggerMoreInfo(principal, requestId, { reason: body.reason }, requestContext);
    writeJson(response, 200, buildSuccessResponse("Additional information requested.", result, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/approve")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/approve".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseReviewBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    context.logger.debug("Trigger approval requested", {
      userId: principal.user.id,
      role: principal.user.role,
      requestId,
      adminRemarks: body.adminRemarks,
    });
    const result = await service.approveTriggerRequest(principal, requestId, { adminRemarks: body.adminRemarks }, requestContext);
    context.logger.debug("Trigger approval completed", {
      userId: principal.user.id,
      requestId,
      requestStatus: result.status,
      proofCount: result.proofCount,
    });
    writeJson(response, 200, buildSuccessResponse("Trigger request approved.", result, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/reject")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/reject".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseReviewBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    const result = await service.rejectTriggerRequest(principal, requestId, { adminRemarks: body.adminRemarks }, requestContext);
    writeJson(response, 200, buildSuccessResponse("Trigger request rejected.", result, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath === "/trigger-requests/super-admin/queue") {
    const requests = await service.listSuperAdminApprovalQueue(principal);
    writeJson(response, 200, buildSuccessResponse("Super Admin approval queue retrieved.", { requests }, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/sa-approve")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/sa-approve".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseReviewBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    const result = await service.superAdminApproveTriggerRequest(principal, requestId, { adminRemarks: body.adminRemarks }, requestContext);
    writeJson(response, 200, buildSuccessResponse("Trigger request approved by Super Admin.", result, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/sa-reject")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/sa-reject".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = parseReviewBody((await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>);
    const result = await service.superAdminRejectTriggerRequest(principal, requestId, { adminRemarks: body.adminRemarks }, requestContext);
    writeJson(response, 200, buildSuccessResponse("Trigger request rejected by Super Admin.", result, context.requestId));
    return;
  }

  if (request.method === "POST" && routePath.startsWith("/trigger-requests/") && routePath.endsWith("/nudge")) {
    const requestId = routePath.slice("/trigger-requests/".length, -"/nudge".length);
    if (!requestId) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const body = (await readJsonBody(request, context.env.REQUEST_BODY_LIMIT)) as Record<string, unknown>;
    const targetUserIds = Array.isArray(body.targetUserIds) ? (body.targetUserIds as string[]) : [];
    const nudgeMessage = typeof body.message === "string" ? body.message.trim() : "";
    if (!targetUserIds.length) {
      throw new HttpError(400, "VALIDATION_ERROR", "targetUserIds must be a non-empty array.");
    }

    await service.sendNudgeNotification(principal, requestId, { targetUserIds, message: nudgeMessage }, requestContext);
    writeJson(response, 200, buildSuccessResponse("Nudge notification sent.", {}, context.requestId));
    return;
  }

  if (request.method === "GET" && routePath.startsWith("/trigger-requests/")) {

    const requestId = routePath.slice("/trigger-requests/".length);
    if (!requestId || requestId.includes("/")) {
      throw new HttpError(404, "NOT_FOUND", "Route not found.");
    }

    const payload = await service.getTriggerRequest(principal, requestId);
    writeJson(
      response,
      200,
      buildSuccessResponse(
        "Trigger request retrieved.",
        {
          request: payload,
          proofs: payload.proofs,
          timeline: payload.timeline,
        },
        context.requestId
      )
    );
    return;
  }

  throw new HttpError(404, "NOT_FOUND", "Route not found.");
}
