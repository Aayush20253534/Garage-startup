const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");

const buildWhere = (query = {}) => {
  const search = String(query.search || "").trim();

  return {
    ...(query.status && { status: query.status }),
    ...(query.severity && { severity: query.severity }),
    ...(query.source && { source: query.source }),
    ...(query.actorType && { actorType: query.actorType }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
        { route: { contains: search, mode: "insensitive" } },
        { endpoint: { contains: search, mode: "insensitive" } },
        { component: { contains: search, mode: "insensitive" } },
        { errorName: { contains: search, mode: "insensitive" } },
      ],
    }),
  };
};

const listIssues = async (query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const where = buildWhere(query);
  const [items, total] = await Promise.all([
    prisma.systemIssue.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { severity: "desc" },
        { lastSeenAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.systemIssue.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const getIssue = async (issueId) => {
  const issue = await prisma.systemIssue.findUnique({
    where: { id: issueId },
  });

  if (!issue) throw new ApiError(404, "System issue not found");
  return issue;
};

const getIssueStats = async () => {
  const [open, investigating, critical, resolved, total, recent] =
    await Promise.all([
      prisma.systemIssue.count({ where: { status: "OPEN" } }),
      prisma.systemIssue.count({ where: { status: "INVESTIGATING" } }),
      prisma.systemIssue.count({
        where: {
          severity: "CRITICAL",
          status: { in: ["OPEN", "INVESTIGATING"] },
        },
      }),
      prisma.systemIssue.count({ where: { status: "RESOLVED" } }),
      prisma.systemIssue.count(),
      prisma.systemIssue.count({
        where: {
          lastSeenAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    open,
    investigating,
    active: open + investigating,
    critical,
    resolved,
    total,
    recent24h: recent,
  };
};

const updateIssueStatus = async (issueId, payload, adminId) => {
  await getIssue(issueId);
  const status = payload.status;
  const isResolved = status === "RESOLVED" || status === "IGNORED";

  return prisma.systemIssue.update({
    where: { id: issueId },
    data: {
      status,
      resolutionNote: payload.resolutionNote?.trim() || null,
      resolvedAt: isResolved ? new Date() : null,
      resolvedById: isResolved ? adminId : null,
    },
  });
};

const deleteIssue = async (issueId) => {
  await getIssue(issueId);
  return prisma.systemIssue.delete({ where: { id: issueId } });
};

const clearResolvedIssues = async () => {
  const result = await prisma.systemIssue.deleteMany({
    where: { status: { in: ["RESOLVED", "IGNORED"] } },
  });

  return { deletedCount: result.count };
};

module.exports = {
  clearResolvedIssues,
  deleteIssue,
  getIssue,
  getIssueStats,
  listIssues,
  updateIssueStatus,
};
