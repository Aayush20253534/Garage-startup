const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deletePattern } = require("../../utils/cache");
const { Resend } = require("resend");

let resend;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  isOnboarded: true,
  createdAt: true,
  customerProfile: true,
  locations: {
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  },
  _count: {
    select: {
      bookings: true,
      vehicles: true,
    },
  },
};

const listCustomers = async (query = {}) => {
  const where = {
    role: "CUSTOMER",
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
      ],
    }),
    ...(query.city && {
      OR: [
        {
          customerProfile: {
            is: { address: { contains: query.city, mode: "insensitive" } },
          },
        },
        {
          locations: {
            some: { address: { contains: query.city, mode: "insensitive" } },
          },
        },
      ],
    }),
    ...(query.isActive !== undefined && {
      isActive: query.isActive === "true",
    }),
  };

  return prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });
};

const listBookings = async (query = {}) => {
  const where = {
    ...(query.status && { status: query.status }),
    ...(query.garageId && { garageId: query.garageId }),
    ...(query.userId && { userId: query.userId }),
    ...(query.search && {
      OR: [
        { bookingCode: { contains: query.search, mode: "insensitive" } },
        {
          user: {
            is: { name: { contains: query.search, mode: "insensitive" } },
          },
        },
        {
          user: {
            is: { email: { contains: query.search, mode: "insensitive" } },
          },
        },
        {
          garage: {
            is: { name: { contains: query.search, mode: "insensitive" } },
          },
        },
      ],
    }),
  };

  return prisma.booking.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      vehicle: true,
      garage: true,
      payment: true,
      services: { include: { service: { include: { category: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
};

const getDashboardStats = async () => {
  const [
    garages,
    activeGarages,
    pendingApplications,
    priceRanges,
    customers,
    bookings,
    openSystemIssues,
    criticalSystemIssues,
    recentApplications,
  ] = await Promise.all([
    prisma.garage.count(),
    prisma.garage.count({ where: { isActive: true } }),
    prisma.garageApplication.count({ where: { status: "PENDING" } }),
    prisma.cityServicePriceRange.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.booking.count(),
    prisma.systemIssue.count({
      where: { status: { in: ["OPEN", "INVESTIGATING"] } },
    }),
    prisma.systemIssue.count({
      where: {
        severity: "CRITICAL",
        status: { in: ["OPEN", "INVESTIGATING"] },
      },
    }),
    prisma.garageApplication.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        garageName: true,
        ownerName: true,
        city: true,
        phone: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    stats: {
      garages,
      activeGarages,
      pendingApplications,
      priceRanges,
      customers,
      bookings,
      openSystemIssues,
      criticalSystemIssues,
    },
    recentApplications,
  };
};

const invalidateUsersNotificationCache = async (userIds = []) => {
  await Promise.all(
    userIds.map((userId) => deletePattern(`customer:${userId}:notifications*`)),
  );
};

const getCityUsers = async (city) => {
  return prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      isActive: true,
      OR: [
        {
          customerProfile: {
            is: { address: { contains: city, mode: "insensitive" } },
          },
        },
        {
          locations: {
            some: { address: { contains: city, mode: "insensitive" } },
          },
        },
      ],
    },
    select: { id: true },
  });
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const searchEmailUsers = async (query = {}) => {
  const search = String(query.search || "").trim();

  return prisma.user.findMany({
    where: {
      ...(query.role && { role: query.role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
};

const sendUserEmail = async ({ userId, subject, message }) => {
  if (!process.env.RESEND_API_KEY || !resend) {
    throw new ApiError(500, "Resend API key missing");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user || !user.email) {
    throw new ApiError(404, "User email not found");
  }

  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Rovauto <onboarding@resend.dev>",
    to: user.email,
    replyTo: process.env.CONTACT_INBOX || "rovauto.offical@gmail.com",
    subject: cleanSubject,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>${escapeHtml(cleanSubject)}</h2>
        <p>Hi ${escapeHtml(user.name || "there")},</p>
        <p>${escapeHtml(cleanMessage).replace(/\n/g, "<br/>")}</p>
        <p style="margin-top: 24px;">Regards,<br/>Rovauto Team</p>
      </div>
    `,
  });

  if (result.error) {
    throw new ApiError(500, result.error.message || "Failed to send email");
  }

  return {
    sent: true,
    recipient: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

const sendNotification = async ({
  audience,
  userId,
  city,
  title,
  message,
  type = "SYSTEM",
  link = null,
}) => {
  if (!title || !message)
    throw new ApiError(400, "Title and message are required");

  if (audience === "ALL") {
    return prisma.notification.create({
      data: {
        userId: null,
        title,
        message,
        type,
        link,
        metadata: { audience: "ALL" },
      },
    });
  }

  if (audience === "USER") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "User not found");

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
        metadata: { audience: "USER" },
      },
    });
    await invalidateUsersNotificationCache([userId]);
    return notification;
  }

  if (audience === "CITY") {
    if (!city) throw new ApiError(400, "City is required");
    const users = await getCityUsers(city);
    if (users.length === 0) {
      return {
        sent: 0,
        city,
        message: "No active customers found for this city",
      };
    }

    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        title,
        message,
        type,
        link,
        metadata: { audience: "CITY", city },
      })),
    });
    await invalidateUsersNotificationCache(users.map((user) => user.id));
    return { sent: users.length, city };
  }

  throw new ApiError(400, "Audience must be ALL, CITY, or USER");
};

module.exports = {
  getDashboardStats,
  listBookings,
  listCustomers,
  searchEmailUsers,
  sendUserEmail,
  sendNotification,
};
