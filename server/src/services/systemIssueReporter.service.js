const crypto = require("crypto");
const prisma = require("../config/prisma");
const { deriveSystemIssueActor } = require("./security/systemIssueActorRules");

const MAX_MESSAGE_LENGTH = 2000;
const MAX_TITLE_LENGTH = 180;
const MAX_STACK_LENGTH = 12000;
const MAX_TEXT_LENGTH = 1000;
const SENSITIVE_KEY_PATTERN =
  /password|token|authorization|cookie|secret|otp|pin|card|cvv|session|cashfreePaymentSession|privateKey/i;

const truncate = (value, maxLength = MAX_TEXT_LENGTH) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength
    ? `${text.slice(0, maxLength)}…`
    : text;
};

const sanitizeValue = (value, depth = 0) => {
  if (depth > 4) return "[Maximum depth reached]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return truncate(value, MAX_TEXT_LENGTH);
  }
  if (["number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .slice(0, 50)
      .reduce((result, [key, item]) => {
        result[key] = SENSITIVE_KEY_PATTERN.test(key)
          ? "[REDACTED]"
          : sanitizeValue(item, depth + 1);
        return result;
      }, {});
  }
  return truncate(value, MAX_TEXT_LENGTH);
};

const normalizeForFingerprint = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      "<uuid>",
    )
    .replace(/\b[0-9a-f]{24,}\b/gi, "<id>")
    .replace(/\b\d{3,}\b/g, "<number>")
    .replace(/\?.*$/, "")
    .replace(/\s+/g, " ")
    .trim();

const createFingerprint = ({
  source,
  errorName,
  message,
  endpoint,
  method,
  component,
  route,
}) => {
  const stableKey = [
    source,
    errorName,
    normalizeForFingerprint(message),
    normalizeForFingerprint(endpoint),
    method,
    component,
    normalizeForFingerprint(route),
  ]
    .filter(Boolean)
    .join("|");

  return crypto
    .createHash("sha256")
    .update(stableKey)
    .digest("hex");
};

const getActorContext = async (req, payload = {}) => {
  const actor = deriveSystemIssueActor({
    account: req?.user || null,
    payloadActorType: payload.actorType,
    hasRequest: Boolean(req),
  });

  if (!actor.needsGarageLookup) {
    const { needsGarageLookup, ...context } = actor;
    return context;
  }

  const garage = await prisma.garage.findFirst({
    where: { ownerId: actor.userId },
    select: { id: true },
  });

  return {
    actorType: actor.actorType,
    userId: actor.userId,
    garageId: garage?.id || null,
  };
};

const buildIssueData = async ({
  req = null,
  error = null,
  payload = {},
}) => {
  const message =
    truncate(
      payload.message ||
        error?.message ||
        "Unknown application error",
      MAX_MESSAGE_LENGTH,
    ) || "Unknown application error";

  const errorName = truncate(
    payload.errorName || error?.name || "Error",
    120,
  );

  const source =
    payload.source === "BACKEND" ? "BACKEND" : "FRONTEND";

  const httpStatus =
    Number(payload.httpStatus || error?.statusCode || 0) || null;

  const severity = [
    "INFO",
    "WARNING",
    "ERROR",
    "CRITICAL",
  ].includes(payload.severity)
    ? payload.severity
    : httpStatus && httpStatus >= 500
      ? "ERROR"
      : "WARNING";

  const route = truncate(
    payload.route || req?.originalUrl || req?.path,
    500,
  );

  const endpoint = truncate(
    payload.endpoint || req?.originalUrl,
    500,
  );

  const method =
    truncate(payload.method || req?.method, 12)?.toUpperCase() ||
    null;

  const component = truncate(payload.component, 180);

  const title =
    truncate(
      payload.title || `${errorName}: ${message}`,
      MAX_TITLE_LENGTH,
    ) || "Application issue";

  const actor = await getActorContext(req, payload);
  const metadata = sanitizeValue(payload.metadata || {});

  const userAgent = truncate(
    payload.userAgent || req?.get?.("user-agent"),
    1000,
  );

  const ipAddress = truncate(
    req?.ip || payload.ipAddress,
    100,
  );

  const environment = truncate(
    payload.environment ||
      process.env.NODE_ENV ||
      "development",
    60,
  );

  const release = truncate(
    payload.release || process.env.RENDER_GIT_COMMIT,
    120,
  );

  const stack = truncate(
    payload.stack || error?.stack,
    MAX_STACK_LENGTH,
  );

  const fingerprint = createFingerprint({
    source,
    errorName,
    message,
    endpoint,
    method,
    component,
    route,
  });

  return {
    fingerprint,
    title,
    message,
    stack,
    source,
    severity,
    actorType: actor.actorType,
    userId: actor.userId,
    garageId: actor.garageId,
    route,
    method,
    endpoint,
    httpStatus,
    errorName,
    component,
    environment,
    release,
    userAgent,
    ipAddress,
    metadata,
  };
};

const storeIssue = async (data) => {
  const existing = await prisma.systemIssue.findUnique({
    where: { fingerprint: data.fingerprint },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existing) {
    return prisma.systemIssue.create({ data });
  }

  const shouldReopen = ["RESOLVED", "IGNORED"].includes(
    existing.status,
  );

  return prisma.systemIssue.update({
    where: { id: existing.id },
    data: {
      ...data,
      occurrenceCount: { increment: 1 },
      lastSeenAt: new Date(),
      ...(shouldReopen && {
        status: "OPEN",
        resolvedAt: null,
        resolvedById: null,
        resolutionNote: null,
      }),
    },
  });
};

const captureIssue = async ({
  req = null,
  error = null,
  payload = {},
}) => {
  try {
    const data = await buildIssueData({
      req,
      error,
      payload,
    });

    return await storeIssue(data);
  } catch (captureError) {
    console.error(
      "[system-issue-monitor] Failed to record issue:",
      captureError.message,
    );

    return null;
  }
};

const captureRequestError = (
  error,
  req,
  context = {},
) =>
  captureIssue({
    req,
    error,
    payload: {
      source: "BACKEND",
      severity:
        Number(
          context.statusCode ||
            error?.statusCode ||
            500,
        ) >= 500
          ? "ERROR"
          : "WARNING",
      httpStatus:
        context.statusCode ||
        error?.statusCode ||
        500,
      title:
        context.title ||
        "Backend request failed",
      component:
        context.component ||
        "Express error middleware",
      metadata: {
        params: req?.params,
        query: req?.query,
        requestId:
          req?.headers?.["x-request-id"] ||
          null,
        ...context.metadata,
      },
    },
  });

const captureBackgroundError = (
  error,
  context = {},
) =>
  captureIssue({
    error,
    payload: {
      source: "BACKEND",
      actorType: "SYSTEM",
      severity: context.severity || "ERROR",
      title:
        context.title ||
        "Background process failed",
      component:
        context.component ||
        "Background worker",
      route: context.route || null,
      endpoint: context.endpoint || null,
      metadata: context.metadata || {},
    },
  });

const captureFrontendReport = (req, payload) =>
  captureIssue({
    req,
    payload: {
      ...payload,
      source: "FRONTEND",
    },
  });

module.exports = {
  getActorContext,
  captureBackgroundError,
  captureFrontendReport,
  captureIssue,
  captureRequestError,
  sanitizeValue,
};
