const prisma = require("../../config/prisma");

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_KEYS = new Set([
  "password",
  "currentpassword",
  "newpassword",
  "otp",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "firebasetoken",
  "idtoken",
  "secret",
]);

const sanitizeValue = (value, depth = 0) => {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase()) ? "[redacted]" : sanitizeValue(item, depth + 1),
    ]),
  );
};

const inferResource = (path = "") => {
  const parts = String(path).split("?")[0].split("/").filter(Boolean);
  const adminIndex = parts.indexOf("admin");
  const resource = parts[adminIndex + 1] || "admin";
  const possibleId = parts[adminIndex + 2];
  const resourceId = possibleId && !["status", "review", "approve-all", "services"].includes(possibleId)
    ? possibleId
    : null;
  return { resource, resourceId };
};

const inferAction = (method, path) => {
  const normalized = String(path || "").toLowerCase();
  if (normalized.includes("/status")) return "STATUS_CHANGED";
  if (normalized.includes("/review")) return "REVIEWED";
  if (normalized.includes("/notes")) return "NOTE_ADDED";
  if (normalized.includes("/garage")) return method === "PATCH" ? "GARAGE_UPDATED" : "GARAGE_ACTION";
  if (normalized.includes("/import")) return "BULK_IMPORTED";
  if (normalized.includes("/schedules")) return "PRICE_SCHEDULE_CHANGED";
  if (normalized.includes("/availability-rules")) return "AVAILABILITY_RULE_CHANGED";
  return method === "POST"
    ? "CREATED"
    : method === "PATCH" || method === "PUT"
      ? "UPDATED"
      : method === "DELETE"
        ? "DELETED"
        : "VIEWED";
};

const recordAuditLog = async ({ req, statusCode }) => {
  const requestPath = req.originalUrl || req.path || "";
  if (!MUTATING_METHODS.has(req.method)) return;

  const actor = req.user;
  const isTrackedStaff = actor?.accountType === "STAFF"
    && ["ADMIN", "SUB_ADMIN", "INTERN"].includes(actor.role);
  if (!isTrackedStaff) return;

  const { resource, resourceId } = inferResource(requestPath);
  await prisma.adminAuditLog.create({
    data: {
      actorId: actor.id || null,
      actorName: actor.name || actor.loginId || actor.email || null,
      actorEmail: actor.email || null,
      actorLoginId: actor.loginId || null,
      actorRole: actor.role || null,
      action: inferAction(req.method, requestPath),
      resource,
      resourceId,
      method: req.method,
      path: requestPath,
      statusCode,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.get?.("user-agent") || null,
      metadata: {
        params: sanitizeValue(req.params || {}),
        query: sanitizeValue(req.query || {}),
        body: sanitizeValue(req.body || {}),
      },
    },
  });
};

const listAuditLogs = async (query = {}) => {
  const take = Math.min(Math.max(Number(query.limit) || 100, 1), 300);
  const search = String(query.search || "").trim();
  return prisma.adminAuditLog.findMany({
    where: {
      ...(query.actorRole && { actorRole: query.actorRole }),
      ...(query.resource && { resource: query.resource }),
      ...(query.action && { action: query.action }),
      ...(search && {
        OR: [
          { actorName: { contains: search, mode: "insensitive" } },
          { actorEmail: { contains: search, mode: "insensitive" } },
          { actorLoginId: { contains: search, mode: "insensitive" } },
          { actorId: { contains: search, mode: "insensitive" } },
          { resource: { contains: search, mode: "insensitive" } },
          { resourceId: { contains: search, mode: "insensitive" } },
          { path: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
};

module.exports = {
  listAuditLogs,
  recordAuditLog,
};
