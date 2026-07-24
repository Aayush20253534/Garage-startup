const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");

const DEFAULT_RULES = [
  { key: "NO_GARAGE_ACCEPTED", label: "No garage accepted", thresholdMinutes: 20, severity: "HIGH" },
  { key: "ASSIGNED_NOT_STARTED", label: "Assigned booking not started", thresholdMinutes: 120, severity: "MEDIUM" },
  { key: "SERVICE_RUNNING_LONG", label: "Service running too long", thresholdMinutes: 480, severity: "HIGH" },
  { key: "PAYMENT_STUCK", label: "Payment needs attention", thresholdMinutes: 30, severity: "HIGH" },
  { key: "SCHEDULE_OVERDUE", label: "Scheduled booking overdue", thresholdMinutes: 60, severity: "MEDIUM" },
];

const ensureRules = async () => {
  await Promise.all(DEFAULT_RULES.map((rule) => prisma.adminEscalationRule.upsert({
    where: { key: rule.key },
    create: rule,
    update: {},
  })));
};

const getCandidateWhere = (rule, cutoff, now) => {
  if (rule.key === "NO_GARAGE_ACCEPTED") {
    return { status: "SEARCHING_GARAGE", garageId: null, createdAt: { lte: cutoff } };
  }
  if (rule.key === "ASSIGNED_NOT_STARTED") {
    return { status: { in: ["GARAGE_ASSIGNED", "CONFIRMED"] }, updatedAt: { lte: cutoff } };
  }
  if (rule.key === "SERVICE_RUNNING_LONG") {
    return { status: "IN_PROGRESS", updatedAt: { lte: cutoff } };
  }
  if (rule.key === "PAYMENT_STUCK") {
    return {
      updatedAt: { lte: cutoff },
      OR: [
        { status: "PENDING_PAYMENT" },
        { payment: { is: { status: "CREATED" } } },
        { payment: { is: { status: "PAID" } }, status: { in: ["PENDING_PAYMENT", "SEARCHING_GARAGE"] } },
      ],
    };
  }
  if (rule.key === "SCHEDULE_OVERDUE") {
    return {
      scheduledDate: { lte: new Date(now.getTime() - rule.thresholdMinutes * 60 * 1000) },
      status: { in: ["SEARCHING_GARAGE", "GARAGE_ASSIGNED", "CONFIRMED", "IN_PROGRESS"] },
    };
  }
  return null;
};

const buildDetail = (rule, booking) => {
  if (rule.key === "NO_GARAGE_ACCEPTED") return "No garage has accepted this booking within the configured response window.";
  if (rule.key === "ASSIGNED_NOT_STARTED") return `Assigned to ${booking.garage?.name || "a garage"}, but service has not started.`;
  if (rule.key === "SERVICE_RUNNING_LONG") return `Service remains in progress at ${booking.garage?.name || "the assigned garage"}.`;
  if (rule.key === "PAYMENT_STUCK") return `Payment status: ${booking.payment?.status || "not created"}; booking status: ${booking.status}.`;
  if (rule.key === "SCHEDULE_OVERDUE") return `Scheduled for ${booking.scheduledDate?.toISOString?.() || booking.scheduledDate}.`;
  return "Booking requires admin attention.";
};

const refreshEscalations = async () => {
  await ensureRules();
  const now = new Date();
  const rules = await prisma.adminEscalationRule.findMany({ where: { enabled: true } });
  const detectedKeys = new Set();

  for (const rule of rules) {
    const cutoff = new Date(now.getTime() - rule.thresholdMinutes * 60 * 1000);
    const where = getCandidateWhere(rule, cutoff, now);
    if (!where) continue;
    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        garage: { select: { id: true, name: true, city: true, phone: true } },
        payment: true,
        vehicle: true,
      },
      orderBy: { updatedAt: "asc" },
      take: 250,
    });

    for (const booking of bookings) {
      const detectionKey = `${booking.id}:${rule.key}`;
      detectedKeys.add(detectionKey);
      const existing = await prisma.bookingEscalation.findUnique({
        where: { bookingId_ruleKey: { bookingId: booking.id, ruleKey: rule.key } },
        select: { status: true },
      });
      await prisma.bookingEscalation.upsert({
        where: { bookingId_ruleKey: { bookingId: booking.id, ruleKey: rule.key } },
        create: {
          bookingId: booking.id,
          ruleKey: rule.key,
          severity: rule.severity,
          title: rule.label,
          detail: buildDetail(rule, booking),
          lastDetectedAt: now,
        },
        update: {
          severity: rule.severity,
          title: rule.label,
          detail: buildDetail(rule, booking),
          lastDetectedAt: now,
          ...(existing?.status === "RESOLVED" && {
            status: "OPEN",
            resolvedAt: null,
            resolutionNote: null,
            acknowledgedAt: null,
            acknowledgedBy: null,
          }),
        },
      });
    }
  }

  const activeEscalations = await prisma.bookingEscalation.findMany({
    where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    select: { id: true, bookingId: true, ruleKey: true },
  });
  const noLongerDetected = activeEscalations.filter(
    (item) => !detectedKeys.has(`${item.bookingId}:${item.ruleKey}`),
  );
  if (noLongerDetected.length) {
    await prisma.bookingEscalation.updateMany({
      where: { id: { in: noLongerDetected.map((item) => item.id) } },
      data: { status: "RESOLVED", resolvedAt: now, resolutionNote: "Automatically resolved after the booking moved forward." },
    });
  }

  return detectedKeys.size;
};

const listEscalations = async (query = {}) => {
  await refreshEscalations();
  return prisma.bookingEscalation.findMany({
    where: {
      ...(query.status && { status: query.status }),
      ...(query.severity && { severity: query.severity }),
    },
    include: {
      booking: {
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          garage: { select: { id: true, name: true, city: true, phone: true } },
          vehicle: true,
          payment: true,
          services: { include: { service: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { severity: "asc" }, { lastDetectedAt: "desc" }],
    take: 300,
  });
};

const updateEscalation = async ({ id, status, note, staff }) => {
  const normalized = String(status || "").toUpperCase();
  if (!["OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(normalized)) {
    throw new ApiError(400, "Select a valid escalation status");
  }
  const existing = await prisma.bookingEscalation.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Escalation not found");
  const now = new Date();
  return prisma.bookingEscalation.update({
    where: { id },
    data: {
      status: normalized,
      ...(normalized === "ACKNOWLEDGED" && {
        acknowledgedAt: now,
        acknowledgedBy: staff?.name || staff?.loginId || staff?.id || "Admin",
      }),
      ...(normalized === "RESOLVED" && {
        resolvedAt: now,
        resolutionNote: String(note || "").trim().slice(0, 1000) || "Resolved by admin",
      }),
      ...(normalized === "OPEN" && {
        acknowledgedAt: null,
        acknowledgedBy: null,
        resolvedAt: null,
        resolutionNote: null,
      }),
    },
  });
};

const listRules = async () => {
  await ensureRules();
  return prisma.adminEscalationRule.findMany({ orderBy: { label: "asc" } });
};

const updateRule = async (id, payload = {}) => {
  const existing = await prisma.adminEscalationRule.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Escalation rule not found");
  const thresholdMinutes = payload.thresholdMinutes === undefined
    ? existing.thresholdMinutes
    : Number(payload.thresholdMinutes);
  if (!Number.isInteger(thresholdMinutes) || thresholdMinutes < 1 || thresholdMinutes > 10080) {
    throw new ApiError(400, "Threshold must be between 1 minute and 7 days");
  }
  const severity = payload.severity ? String(payload.severity).toUpperCase() : existing.severity;
  if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity)) {
    throw new ApiError(400, "Select a valid severity");
  }
  return prisma.adminEscalationRule.update({
    where: { id },
    data: {
      enabled: payload.enabled === undefined ? existing.enabled : payload.enabled === true,
      thresholdMinutes,
      severity,
    },
  });
};

module.exports = {
  listEscalations,
  listRules,
  refreshEscalations,
  updateEscalation,
  updateRule,
};
