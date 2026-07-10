const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const notificationService = require("../../customer/services/notification.service");
const supportNotificationService = require("../../customerSupport/services/supportNotification.service");

const PUBLIC_TICKET_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  },
  booking: {
    include: {
      garage: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          city: true,
          area: true,
          ratingAvg: true,
        },
      },
      vehicle: true,
      payment: true,
      services: {
        include: {
          service: { include: { category: true } },
        },
      },
    },
  },
  supportAssignee: {
    select: { id: true, name: true, email: true, isActive: true },
  },
  attachments: { orderBy: { order: "asc" } },
  messages: {
    orderBy: { createdAt: "asc" },
    include: { attachments: { orderBy: { order: "asc" } } },
  },
};

const sanitizeText = (value, maxLength) =>
  String(value || "").trim().slice(0, maxLength);

const getStartOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const getTicketStats = async () => {
  const today = getStartOfToday();
  const [total, open, inReview, waitingCustomer, urgent, disputes, resolvedToday, unassigned] =
    await Promise.all([
      prisma.supportTicket.count(),
      prisma.supportTicket.count({ where: { status: "OPEN" } }),
      prisma.supportTicket.count({ where: { status: "IN_REVIEW" } }),
      prisma.supportTicket.count({ where: { status: "WAITING_CUSTOMER" } }),
      prisma.supportTicket.count({
        where: {
          priority: "URGENT",
          status: { in: ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"] },
        },
      }),
      prisma.supportTicket.count({
        where: {
          type: "DISPUTE",
          status: { in: ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"] },
        },
      }),
      prisma.supportTicket.count({ where: { resolvedAt: { gte: today } } }),
      prisma.supportTicket.count({
        where: {
          supportAssigneeId: null,
          status: { in: ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"] },
        },
      }),
    ]);

  return { total, open, inReview, waitingCustomer, urgent, disputes, resolvedToday, unassigned };
};

const buildWhere = (query = {}) => {
  const search = sanitizeText(query.search, 160);
  return {
    ...(query.type && { type: query.type }),
    ...(query.status && { status: query.status }),
    ...(query.priority && { priority: query.priority }),
    ...(query.category && { category: query.category }),
    ...(query.supportAssigneeId === "unassigned"
      ? { supportAssigneeId: null }
      : query.supportAssigneeId
        ? { supportAssigneeId: query.supportAssigneeId }
        : {}),
    ...(search && {
      OR: [
        { ticketCode: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { user: { is: { name: { contains: search, mode: "insensitive" } } } },
        { user: { is: { email: { contains: search, mode: "insensitive" } } } },
        { user: { is: { phone: { contains: search, mode: "insensitive" } } } },
        {
          booking: {
            is: { bookingCode: { contains: search, mode: "insensitive" } },
          },
        },
        {
          supportAssignee: {
            is: { name: { contains: search, mode: "insensitive" } },
          },
        },
      ],
    }),
  };
};

const listTickets = async (query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const where = buildWhere(query);

  const [items, total, stats] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        booking: {
          select: {
            id: true,
            bookingCode: true,
            status: true,
            garage: { select: { id: true, name: true } },
            vehicle: {
              select: { brand: true, model: true, registrationNumber: true },
            },
          },
        },
        supportAssignee: {
          select: { id: true, name: true, email: true, isActive: true },
        },
        _count: { select: { messages: true, attachments: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            authorType: true,
            authorName: true,
            body: true,
            isInternal: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        { lastMessageAt: "desc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.supportTicket.count({ where }),
    getTicketStats(),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
    stats,
  };
};

const getTicket = async (ticketId) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: PUBLIC_TICKET_INCLUDE,
  });
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  return ticket;
};

const notifyCustomer = async (ticket, title, message) =>
  notificationService
    .createNotification({
      userId: ticket.userId,
      title,
      message,
      type: "SYSTEM",
      link: `/dashboard/support?ticket=${ticket.id}`,
      metadata: {
        supportTicketId: ticket.id,
        ticketCode: ticket.ticketCode,
        ticketType: ticket.type,
      },
    })
    .catch((error) => {
      console.warn("[support-ticket] customer notification failed", {
        ticketId: ticket.id,
        message: error?.message,
      });
    });

const updateTicket = async ({ ticketId, data }) => {
  const existing = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });
  if (!existing) throw new ApiError(404, "Support ticket not found");

  const nextStatus = data.status || existing.status;
  const resolving = ["RESOLVED", "CLOSED"].includes(nextStatus);
  const hasResolutionNote = Object.prototype.hasOwnProperty.call(data, "resolutionNote");
  const hasResolutionOutcome = Object.prototype.hasOwnProperty.call(data, "resolutionOutcome");
  const effectiveResolutionNote = hasResolutionNote
    ? sanitizeText(data.resolutionNote, 3000)
    : sanitizeText(existing.resolutionNote, 3000);
  const effectiveResolutionOutcome = hasResolutionOutcome
    ? data.resolutionOutcome || null
    : existing.resolutionOutcome;

  if (resolving && !effectiveResolutionNote) {
    throw new ApiError(400, "A resolution note is required before resolving a ticket");
  }
  if (existing.type === "DISPUTE" && resolving && !effectiveResolutionOutcome) {
    throw new ApiError(400, "Select a dispute resolution outcome");
  }

  const refundAmount =
    data.refundAmount === undefined
      ? existing.refundAmount
      : data.refundAmount === null || data.refundAmount === ""
        ? null
        : Math.max(Math.round(Number(data.refundAmount)), 0);

  if (refundAmount !== null && !Number.isFinite(refundAmount)) {
    throw new ApiError(400, "Refund amount must be a valid number");
  }

  let assignee = null;
  if (data.supportAssigneeId) {
    assignee = await prisma.customerSupportAccount.findFirst({
      where: { id: data.supportAssigneeId, isActive: true },
      select: { id: true, name: true, email: true },
    });
    if (!assignee) throw new ApiError(404, "Active customer support account not found");
  }

  const changedAssignee =
    Object.prototype.hasOwnProperty.call(data, "supportAssigneeId") &&
    (data.supportAssigneeId || null) !== existing.supportAssigneeId;

  const updated = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.priority && { priority: data.priority }),
      ...(Object.prototype.hasOwnProperty.call(data, "supportAssigneeId") && {
        supportAssigneeId: data.supportAssigneeId || null,
        claimedAt: data.supportAssigneeId ? new Date() : null,
        assignedToId: null,
      }),
      ...(hasResolutionOutcome && {
        resolutionOutcome: data.resolutionOutcome || null,
      }),
      ...(hasResolutionNote && {
        resolutionNote: effectiveResolutionNote || null,
      }),
      ...(Object.prototype.hasOwnProperty.call(data, "refundAmount") && {
        refundAmount,
      }),
      ...(resolving
        ? { resolvedAt: existing.resolvedAt || new Date() }
        : data.status
          ? { resolvedAt: null }
          : {}),
    },
    include: PUBLIC_TICKET_INCLUDE,
  });

  if (changedAssignee && assignee) {
    await supportNotificationService.notifyAccount(assignee.id, {
      title: "Support ticket assigned to you",
      message: `${updated.ticketCode}: ${updated.subject}`,
      link: `/support/tickets?ticket=${updated.id}`,
      metadata: {
        ticketId: updated.id,
        ticketCode: updated.ticketCode,
        assignedByAdmin: true,
      },
    }).catch(() => null);
  }

  if (data.status && data.status !== existing.status) {
    const readable = data.status.replaceAll("_", " ").toLowerCase();
    await notifyCustomer(
      updated,
      `Support ticket ${readable}`,
      `${updated.ticketCode} is now ${readable}.`,
    );
  }

  return updated;
};

const replyToTicket = async ({ ticketId, body, staff }) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });
  if (!ticket) throw new ApiError(404, "Support ticket not found");
  if (ticket.status === "CLOSED") {
    throw new ApiError(400, "Closed tickets cannot receive internal notes");
  }

  const messageBody = sanitizeText(body, 5000);
  if (!messageBody) throw new ApiError(400, "Internal note is required");

  await prisma.supportTicketMessage.create({
    data: {
      ticketId,
      authorType: "ADMIN",
      authorStaffId: staff.id,
      authorName: staff.name,
      body: messageBody,
      isInternal: true,
    },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { lastMessageAt: new Date() },
  });

  return getTicket(ticketId);
};

const listStaff = async () =>
  prisma.customerSupportAccount.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      lastLoginAt: true,
    },
    orderBy: { name: "asc" },
  });

module.exports = {
  getTicket,
  getTicketStats,
  listStaff,
  listTickets,
  replyToTicket,
  updateTicket,
};
