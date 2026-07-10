const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const notificationService = require("../../customer/services/notification.service");
const adminOperationsService = require("../../admin/services/adminOperations.service");

const ACTIVE_STATUSES = ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"];
const SUPPORT_STATUS_OPTIONS = [
  "OPEN",
  "IN_REVIEW",
  "WAITING_CUSTOMER",
  "RESOLVED",
];

const TICKET_INCLUDE = {
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

const isTransactionConflict = (error) =>
  error?.code === "P2034" ||
  /write conflict|deadlock|serialization/i.test(String(error?.message || ""));

const runTicketTransaction = async (callback) => {
  try {
    return await prisma.$transaction(callback, {
      isolationLevel: "Serializable",
    });
  } catch (error) {
    if (isTransactionConflict(error)) {
      throw new ApiError(
        409,
        "Another customer support agent changed this ticket. Refresh and try again",
      );
    }
    throw error;
  }
};

const getStartOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const getTicketWithPermissions = async (ticketId, supportAccountId) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: TICKET_INCLUDE,
  });

  if (!ticket) throw new ApiError(404, "Support ticket not found");

  return {
    ...ticket,
    canClaim:
      !ticket.supportAssigneeId && !["CLOSED", "RESOLVED"].includes(ticket.status),
    canRespond:
      (!ticket.supportAssigneeId || ticket.supportAssigneeId === supportAccountId) &&
      ticket.status !== "CLOSED",
    assignedToMe: ticket.supportAssigneeId === supportAccountId,
  };
};

const buildWhere = (query = {}, supportAccountId) => {
  const search = sanitizeText(query.search, 160);
  const queue = query.queue || "AVAILABLE";

  const queueWhere =
    queue === "MINE"
      ? { supportAssigneeId: supportAccountId }
      : queue === "UNASSIGNED"
        ? { supportAssigneeId: null }
        : queue === "ALL"
          ? {}
          : {
              OR: [
                { supportAssigneeId: null },
                { supportAssigneeId: supportAccountId },
              ],
            };

  const filters = {
    ...(query.type && { type: query.type }),
    ...(query.status && { status: query.status }),
    ...(query.priority && { priority: query.priority }),
    ...(query.category && { category: query.category }),
  };

  if (!search) {
    return { ...queueWhere, ...filters };
  }

  return {
    AND: [
      queueWhere,
      filters,
      {
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
        ],
      },
    ],
  };
};

const getDashboard = async (supportAccountId) => {
  const today = getStartOfToday();

  const [
    unassigned,
    assignedToMe,
    waitingCustomer,
    urgent,
    openDisputes,
    resolvedToday,
    unreadNotifications,
    emailsSentToday,
    recentTickets,
    recentNotifications,
  ] = await Promise.all([
    prisma.supportTicket.count({
      where: { supportAssigneeId: null, status: { in: ACTIVE_STATUSES } },
    }),
    prisma.supportTicket.count({
      where: { supportAssigneeId: supportAccountId, status: { in: ACTIVE_STATUSES } },
    }),
    prisma.supportTicket.count({
      where: { supportAssigneeId: supportAccountId, status: "WAITING_CUSTOMER" },
    }),
    prisma.supportTicket.count({
      where: {
        OR: [
          { supportAssigneeId: null },
          { supportAssigneeId: supportAccountId },
        ],
        priority: "URGENT",
        status: { in: ACTIVE_STATUSES },
      },
    }),
    prisma.supportTicket.count({
      where: {
        OR: [
          { supportAssigneeId: null },
          { supportAssigneeId: supportAccountId },
        ],
        type: "DISPUTE",
        status: { in: ACTIVE_STATUSES },
      },
    }),
    prisma.supportTicket.count({
      where: {
        supportAssigneeId: supportAccountId,
        status: "RESOLVED",
        resolvedAt: { gte: today },
      },
    }),
    prisma.customerSupportNotification.count({
      where: { supportAccountId, isRead: false },
    }),
    prisma.customerSupportEmailLog.count({
      where: { supportAccountId, status: "SENT", createdAt: { gte: today } },
    }),
    prisma.supportTicket.findMany({
      where: {
        OR: [
          { supportAssigneeId: null },
          { supportAssigneeId: supportAccountId },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        booking: { select: { id: true, bookingCode: true } },
        supportAssignee: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true, attachments: true } },
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.customerSupportNotification.findMany({
      where: { supportAccountId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return {
    stats: {
      unassigned,
      assignedToMe,
      waitingCustomer,
      urgent,
      openDisputes,
      resolvedToday,
      unreadNotifications,
      emailsSentToday,
    },
    recentTickets,
    recentNotifications,
  };
};

const listTickets = async (query, supportAccountId) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const where = buildWhere(query, supportAccountId);

  const [items, total] = await Promise.all([
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
  ]);

  return {
    items: items.map((ticket) => ({
      ...ticket,
      canClaim:
        !ticket.supportAssigneeId && !["CLOSED", "RESOLVED"].includes(ticket.status),
      canRespond:
        (!ticket.supportAssigneeId || ticket.supportAssigneeId === supportAccountId) &&
        ticket.status !== "CLOSED",
      assignedToMe: ticket.supportAssigneeId === supportAccountId,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
};

const claimTicket = async (ticketId, supportAccount) => {
  const result = await prisma.supportTicket.updateMany({
    where: {
      id: ticketId,
      supportAssigneeId: null,
      status: { in: ACTIVE_STATUSES },
    },
    data: {
      supportAssigneeId: supportAccount.id,
      claimedAt: new Date(),
      assignedToId: null,
    },
  });

  if (result.count === 0) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, supportAssigneeId: true, status: true },
    });

    if (!ticket) throw new ApiError(404, "Support ticket not found");
    if (ticket.supportAssigneeId === supportAccount.id) {
      return getTicketWithPermissions(ticketId, supportAccount.id);
    }

    throw new ApiError(
      409,
      ticket.supportAssigneeId
        ? "Another customer support agent already claimed this ticket"
        : "This ticket can no longer be claimed",
    );
  }

  return getTicketWithPermissions(ticketId, supportAccount.id);
};

const releaseTicket = async (ticketId, supportAccountId) => {
  const result = await prisma.supportTicket.updateMany({
    where: {
      id: ticketId,
      supportAssigneeId: supportAccountId,
      status: { in: ACTIVE_STATUSES },
    },
    data: { supportAssigneeId: null, claimedAt: null },
  });

  if (result.count === 0) {
    throw new ApiError(409, "Only the assigned agent can release this active ticket");
  }

  return getTicketWithPermissions(ticketId, supportAccountId);
};

const ensureOwnershipInTransaction = async (tx, ticketId, supportAccount) => {
  let ticket = await tx.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      userId: true,
      ticketCode: true,
      type: true,
      subject: true,
      status: true,
      supportAssigneeId: true,
      resolutionNote: true,
    },
  });

  if (!ticket) throw new ApiError(404, "Support ticket not found");
  if (ticket.status === "CLOSED") {
    throw new ApiError(400, "Closed tickets cannot be changed");
  }

  if (!ticket.supportAssigneeId) {
    const claimed = await tx.supportTicket.updateMany({
      where: { id: ticketId, supportAssigneeId: null },
      data: {
        supportAssigneeId: supportAccount.id,
        claimedAt: new Date(),
        assignedToId: null,
      },
    });

    if (claimed.count === 0) {
      ticket = await tx.supportTicket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          userId: true,
          ticketCode: true,
          type: true,
          subject: true,
          status: true,
          supportAssigneeId: true,
          resolutionNote: true,
        },
      });
    } else {
      ticket.supportAssigneeId = supportAccount.id;
    }
  }

  if (ticket.supportAssigneeId !== supportAccount.id) {
    throw new ApiError(
      409,
      "This ticket is currently assigned to another customer support agent",
    );
  }

  return ticket;
};

const replyToTicket = async ({ ticketId, body, isInternal = false, supportAccount }) => {
  const messageBody = sanitizeText(body, 5000);
  if (!messageBody) throw new ApiError(400, "Reply is required");

  const ticket = await runTicketTransaction(async (tx) => {
      const ownedTicket = await ensureOwnershipInTransaction(
        tx,
        ticketId,
        supportAccount,
      );
      const now = new Date();

      await tx.supportTicketMessage.create({
        data: {
          ticketId,
          authorType: "CUSTOMER_SUPPORT",
          authorSupportId: supportAccount.id,
          authorName: supportAccount.name,
          body: messageBody,
          isInternal: Boolean(isInternal),
        },
      });

      await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: isInternal ? "IN_REVIEW" : "WAITING_CUSTOMER",
          lastMessageAt: now,
          resolvedAt: null,
        },
      });

      return ownedTicket;
    });

  if (!isInternal) {
    await notificationService
      .createNotification({
        userId: ticket.userId,
        title: "Rovauto support replied",
        message: `${ticket.ticketCode}: ${messageBody.slice(0, 140)}`,
        type: "SYSTEM",
        link: `/dashboard/support?ticket=${ticket.id}`,
        metadata: {
          supportTicketId: ticket.id,
          ticketCode: ticket.ticketCode,
        },
      })
      .catch((error) => {
        console.warn("[customer-support] customer notification failed", {
          ticketId,
          message: error?.message,
        });
      });
  }

  return getTicketWithPermissions(ticketId, supportAccount.id);
};

const updateTicket = async ({ ticketId, data, supportAccount }) => {
  const nextStatus = data.status;
  if (nextStatus && !SUPPORT_STATUS_OPTIONS.includes(nextStatus)) {
    throw new ApiError(400, "Invalid ticket status");
  }

  const result = await runTicketTransaction(async (tx) => {
      const ticket = await ensureOwnershipInTransaction(
        tx,
        ticketId,
        supportAccount,
      );

      if (ticket.type === "DISPUTE" && nextStatus === "RESOLVED") {
        throw new ApiError(403, "Only an admin can resolve a dispute");
      }

      const resolutionNote = Object.prototype.hasOwnProperty.call(data, "resolutionNote")
        ? sanitizeText(data.resolutionNote, 3000)
        : sanitizeText(ticket.resolutionNote, 3000);

      if (nextStatus === "RESOLVED" && !resolutionNote) {
        throw new ApiError(400, "A resolution note is required");
      }

      await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          ...(data.status && { status: data.status }),
          ...(data.priority && { priority: data.priority }),
          ...(Object.prototype.hasOwnProperty.call(data, "resolutionNote") && {
            resolutionNote: resolutionNote || null,
          }),
          ...(nextStatus === "RESOLVED"
            ? { resolvedAt: new Date() }
            : data.status
              ? { resolvedAt: null }
              : {}),
        },
      });

      return ticket;
    });

  if (data.status && data.status !== result.status) {
    const readable = data.status.replaceAll("_", " ").toLowerCase();
    await notificationService
      .createNotification({
        userId: result.userId,
        title: `Support ticket ${readable}`,
        message: `${result.ticketCode} is now ${readable}.`,
        type: "SYSTEM",
        link: `/dashboard/support?ticket=${result.id}`,
        metadata: { supportTicketId: result.id, ticketCode: result.ticketCode },
      })
      .catch(() => null);
  }

  return getTicketWithPermissions(ticketId, supportAccount.id);
};

const listNotifications = async (supportAccountId) => {
  const [items, unreadCount] = await Promise.all([
    prisma.customerSupportNotification.findMany({
      where: { supportAccountId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.customerSupportNotification.count({
      where: { supportAccountId, isRead: false },
    }),
  ]);

  return { items, unreadCount };
};

const markNotificationRead = async (notificationId, supportAccountId) => {
  const result = await prisma.customerSupportNotification.updateMany({
    where: { id: notificationId, supportAccountId },
    data: { isRead: true },
  });

  if (result.count === 0) throw new ApiError(404, "Notification not found");
  return { read: true };
};

const markAllNotificationsRead = async (supportAccountId) => {
  const result = await prisma.customerSupportNotification.updateMany({
    where: { supportAccountId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
};

const searchEmailUsers = async (query) =>
  adminOperationsService.searchEmailUsers(query);

const sendCustomerNotification = async (payload) =>
  adminOperationsService.sendNotification(payload);

const sendUserEmail = async ({ supportAccount, payload }) => {
  let recipient = null;

  try {
    const result = await adminOperationsService.sendUserEmail(payload);
    recipient = result.recipient;

    await prisma.customerSupportEmailLog.create({
      data: {
        supportAccountId: supportAccount.id,
        userId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        subject: sanitizeText(payload.subject, 300),
        status: "SENT",
      },
    });

    return result;
  } catch (error) {
    const user = payload.userId
      ? await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, name: true, email: true },
        })
      : null;

    await prisma.customerSupportEmailLog
      .create({
        data: {
          supportAccountId: supportAccount.id,
          userId: user?.id || null,
          recipientEmail: user?.email || "unknown",
          recipientName: user?.name || null,
          subject: sanitizeText(payload.subject, 300),
          status: "FAILED",
          errorMessage: sanitizeText(error?.message, 1000),
        },
      })
      .catch(() => null);

    throw error;
  }
};

const listEmailLogs = async (supportAccountId) =>
  prisma.customerSupportEmailLog.findMany({
    where: { supportAccountId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

module.exports = {
  claimTicket,
  getDashboard,
  getTicket: getTicketWithPermissions,
  listEmailLogs,
  listNotifications,
  listTickets,
  markAllNotificationsRead,
  markNotificationRead,
  releaseTicket,
  replyToTicket,
  searchEmailUsers,
  sendCustomerNotification,
  sendUserEmail,
  updateTicket,
};
