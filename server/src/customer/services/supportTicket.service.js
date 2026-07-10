const crypto = require("crypto");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { uploadToCloudinary } = require("../../utils/cloudinaryUpload");
const { createActivity } = require("./activity.service");

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const TICKET_INCLUDE = {
  booking: {
    select: {
      id: true,
      bookingCode: true,
      status: true,
      totalServiceAmount: true,
      payableAmount: true,
      createdAt: true,
      garage: {
        select: {
          id: true,
          name: true,
          phone: true,
          city: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          brand: true,
          model: true,
          registrationNumber: true,
        },
      },
      services: {
        include: {
          service: {
            select: { id: true, name: true },
          },
        },
      },
      payment: {
        select: {
          status: true,
          amount: true,
          currency: true,
        },
      },
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
  attachments: {
    orderBy: { order: "asc" },
  },
  messages: {
    where: { isInternal: false },
    orderBy: { createdAt: "asc" },
    include: {
      attachments: {
        orderBy: { order: "asc" },
      },
    },
  },
};

const sanitizeText = (value, maxLength) =>
  String(value || "").trim().slice(0, maxLength);

const validateAttachments = (files = []) => {
  if (!Array.isArray(files) || files.length === 0) return;

  if (files.length > MAX_ATTACHMENTS) {
    throw new ApiError(400, `Maximum ${MAX_ATTACHMENTS} evidence images allowed`);
  }

  files.forEach((file) => {
    if (!String(file.mimetype || "").startsWith("image/")) {
      throw new ApiError(400, "Only image evidence is allowed");
    }

    if (Number(file.size || 0) > MAX_ATTACHMENT_SIZE) {
      throw new ApiError(400, "Each evidence image must be under 10 MB");
    }
  });
};

const uploadAttachments = async (files = []) => {
  validateAttachments(files);

  const uploaded = [];
  for (const file of files) {
    const result = await uploadToCloudinary(
      file.buffer,
      "project-x/support-tickets",
      "image",
    );

    uploaded.push({
      imageUrl: result.secure_url,
      publicId: result.public_id,
    });
  }

  return uploaded;
};

const generateTicketCode = async () => {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = crypto.randomInt(1000, 10000);
    const ticketCode = `RVT-${datePart}-${suffix}`;
    const exists = await prisma.supportTicket.findUnique({
      where: { ticketCode },
      select: { id: true },
    });

    if (!exists) return ticketCode;
  }

  throw new ApiError(500, "Unable to generate a support ticket number");
};

const assertOwnedBooking = async (userId, bookingId) => {
  if (!bookingId) return null;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true, bookingCode: true, garageId: true },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  return booking;
};

const createTicket = async ({ user, data, files = [] }) => {
  const type = String(data.type || "SUPPORT").toUpperCase();
  const category = String(data.category || "GENERAL").toUpperCase();
  const priority = String(data.priority || "NORMAL").toUpperCase();
  const bookingId = data.bookingId || null;

  if (type === "DISPUTE" && !bookingId) {
    throw new ApiError(400, "A booking is required for a dispute");
  }

  await assertOwnedBooking(user.id, bookingId);
  const uploaded = await uploadAttachments(files);
  const ticketCode = await generateTicketCode();
  const subject = sanitizeText(data.subject, 160);
  const description = sanitizeText(data.description, 5000);

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketCode,
      userId: user.id,
      bookingId,
      type,
      category,
      priority,
      subject,
      description,
      status: "OPEN",
      lastMessageAt: new Date(),
      messages: {
        create: {
          authorType: "CUSTOMER",
          authorUserId: user.id,
          authorName: user.name,
          body: description,
        },
      },
      attachments: uploaded.length
        ? {
            create: uploaded.map((item, index) => ({
              ...item,
              order: index,
            })),
          }
        : undefined,
    },
    include: TICKET_INCLUDE,
  });

  await createActivity(user.id, {
    type: "SUPPORT",
    title: type === "DISPUTE" ? "Booking dispute raised" : "Support ticket created",
    detail: `${ticket.ticketCode}: ${ticket.subject}`,
    path: "/dashboard/support",
    metadata: { ticketId: ticket.id, ticketCode: ticket.ticketCode, type },
  }).catch(() => null);

  return ticket;
};

const listMyTickets = async (userId) => {
  return prisma.supportTicket.findMany({
    where: { userId },
    include: {
      booking: {
        select: {
          id: true,
          bookingCode: true,
          status: true,
          garage: { select: { id: true, name: true } },
          vehicle: {
            select: {
              brand: true,
              model: true,
              registrationNumber: true,
            },
          },
        },
      },
      assignedTo: { select: { id: true, name: true, role: true } },
      _count: { select: { messages: true, attachments: true } },
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          authorType: true,
          authorName: true,
          body: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
  });
};

const getMyTicket = async (userId, ticketId) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
    include: TICKET_INCLUDE,
  });

  if (!ticket) {
    throw new ApiError(404, "Support ticket not found");
  }

  return ticket;
};

const replyToTicket = async ({ user, ticketId, body }) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId: user.id },
    select: { id: true, ticketCode: true, status: true },
  });

  if (!ticket) {
    throw new ApiError(404, "Support ticket not found");
  }

  if (ticket.status === "CLOSED") {
    throw new ApiError(400, "Closed tickets cannot receive new replies");
  }

  const messageBody = sanitizeText(body, 5000);
  const now = new Date();

  await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId,
        authorType: "CUSTOMER",
        authorUserId: user.id,
        authorName: user.name,
        body: messageBody,
      },
    }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: ticket.status === "RESOLVED" ? "OPEN" : "IN_REVIEW",
        ...(ticket.status === "RESOLVED" && { resolvedAt: null }),
        lastMessageAt: now,
      },
    }),
  ]);

  return getMyTicket(user.id, ticketId);
};

const closeTicket = async ({ userId, ticketId }) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
    select: { id: true, status: true, resolvedAt: true },
  });

  if (!ticket) {
    throw new ApiError(404, "Support ticket not found");
  }

  if (ticket.status === "CLOSED") {
    return getMyTicket(userId, ticketId);
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: "CLOSED",
      resolvedAt: ticket.resolvedAt || new Date(),
      lastMessageAt: new Date(),
    },
  });

  return getMyTicket(userId, ticketId);
};

const listRecentBookings = async (userId) => {
  return prisma.booking.findMany({
    where: { userId },
    select: {
      id: true,
      bookingCode: true,
      status: true,
      createdAt: true,
      garage: { select: { id: true, name: true } },
      vehicle: {
        select: {
          brand: true,
          model: true,
          registrationNumber: true,
        },
      },
      services: {
        include: { service: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
};

module.exports = {
  closeTicket,
  createTicket,
  getMyTicket,
  listMyTickets,
  listRecentBookings,
  replyToTicket,
};
