const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deletePattern } = require("../../utils/cache");
const { deleteFromCloudinary } = require("../../utils/cloudinaryUpload");
const { Resend } = require("resend");
const notificationService = require("../../customer/services/notification.service");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const dangerousService = require("./dangerous.service");
const garageControllerService = require("../../garage/services/controller.service");
const { setBookingActorContext } = require("./bookingActorContext.service");
const vehicleRegistrationService = require("../../customer/services/vehicleRegistration.service");

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

const CUSTOMER_ONLINE_WINDOW_MS = 5 * 60 * 1000;

const getSessionDeviceKey = (session) => {
  if (session.deviceId) return `device:${session.deviceId}`;

  const normalizedUserAgent = String(session.userAgent || "")
    .trim()
    .toLowerCase();

  // Sessions created before stable device IDs were introduced are grouped by
  // browser signature. This gives existing accounts a useful best-effort count.
  if (normalizedUserAgent) return `legacy-ua:${normalizedUserAgent}`;

  return `session:${session.id}`;
};

const attachCustomerSessionStatus = async (customers = []) => {
  const userIds = customers.map((customer) => customer.id);

  if (!userIds.length) return customers;

  const now = new Date();
  const onlineCutoff = new Date(
    now.getTime() - CUSTOMER_ONLINE_WINDOW_MS,
  );

  const sessions = await prisma.userSession.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      userAgent: true,
      deviceId: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  const sessionsByUserId = new Map();

  for (const session of sessions) {
    const list = sessionsByUserId.get(session.userId) || [];
    list.push(session);
    sessionsByUserId.set(session.userId, list);
  }

  return customers.map((customer) => {
    const customerSessions = sessionsByUserId.get(customer.id) || [];
    const knownDevices = new Set();
    const activeDevices = new Set();
    let activeSessionCount = 0;
    let activeLastSeenAt = null;
    let lastSeenAt = null;

    for (const session of customerSessions) {
      const deviceKey = getSessionDeviceKey(session);
      knownDevices.add(deviceKey);

      if (!lastSeenAt || session.lastSeenAt > lastSeenAt) {
        lastSeenAt = session.lastSeenAt;
      }

      const isActive = !session.revokedAt && session.expiresAt > now;
      if (!isActive) continue;

      activeSessionCount += 1;
      activeDevices.add(deviceKey);

      if (!activeLastSeenAt || session.lastSeenAt > activeLastSeenAt) {
        activeLastSeenAt = session.lastSeenAt;
      }
    }

    return {
      ...customer,
      isLoggedIn: activeSessionCount > 0,
      isOnline:
        activeSessionCount > 0 &&
        activeLastSeenAt &&
        activeLastSeenAt >= onlineCutoff,
      activeSessionCount,
      activeDeviceCount: activeDevices.size,
      knownDeviceCount: knownDevices.size,
      lastSeenAt,
    };
  });
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

  const customers = await prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });

  return attachCustomerSessionStatus(customers);
};

const listVehicles = async (query = {}) => {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 40)));
  const search = String(query.search || "").trim();
  const verificationStatus = String(query.verificationStatus || "").trim();

  const where = {
    ...(search && {
      OR: [
        { registrationNumber: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { user: { is: { name: { contains: search, mode: "insensitive" } } } },
        { user: { is: { email: { contains: search, mode: "insensitive" } } } },
        { user: { is: { phone: { contains: search, mode: "insensitive" } } } },
      ],
    }),
    ...(verificationStatus === "VERIFIED" && { registrationVerified: true }),
    ...(verificationStatus === "UNVERIFIED" && {
      registrationVerified: false,
      registrationNumber: { not: null },
    }),
    ...(verificationStatus === "MISSING" && { registrationNumber: null }),
  };

  const [items, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        fuelType: true,
        registrationNumber: true,
        registrationVerified: true,
        registrationVerifiedAt: true,
        registrationVerificationProvider: true,
        rcOwnerNameMasked: true,
        rcMaker: true,
        rcModel: true,
        rcFuelType: true,
        rcVehicleClass: true,
        rcStatus: true,
        isDefault: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            vehicleRegistrationRequired: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
};

const lookupVehicleRegistration = async (registrationNumber) => {
  const result = await vehicleRegistrationService.lookupRegistrationForAdmin(
    registrationNumber,
  );

  if (!result.verified) {
    throw new ApiError(404, "Vehicle registration was not found by Way2API");
  }

  return {
    provider: result.provider,
    registrationNumber: result.registrationNumber,
    ownerName: result.vehicle?.ownerName || null,
    registeredPhone: null,
    phoneAvailable: false,
    phoneUnavailableReason:
      "Way2API Vehicle RC Verification does not return the registered phone number.",
    vehicle: {
      maker: result.vehicle?.maker || null,
      model: result.vehicle?.model || null,
      fuelType: result.vehicle?.fuelType || null,
      vehicleClass: result.vehicle?.vehicleClass || null,
      status: result.vehicle?.status || null,
      registrationDate: result.vehicle?.registrationDate || null,
      registeredAt: result.vehicle?.registeredAt || null,
      insuranceUpto: result.vehicle?.insuranceUpto || null,
    },
  };
};

const deleteCustomers = async ({ customerIds = [], requestedById = null } = {}) =>
  dangerousService.deleteCustomerUsersByIds({
    userIds: customerIds,
    requestedById,
  });

const setCustomerActiveStatus = async ({
  userId,
  isActive,
  requestedById = null,
}) => {
  const nextIsActive = isActive === true;
  const changedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existingCustomer = await tx.user.findFirst({
      where: { id: userId, role: "CUSTOMER" },
      select: { id: true, isActive: true },
    });

    if (!existingCustomer) {
      throw new ApiError(404, "Customer not found");
    }

    const customer = await tx.user.update({
      where: { id: existingCustomer.id },
      data: { isActive: nextIsActive },
      select: userSelect,
    });

    let revokedSessionCount = 0;

    if (!nextIsActive) {
      const revokedSessions = await tx.userSession.updateMany({
        where: {
          userId: existingCustomer.id,
          revokedAt: null,
        },
        data: { revokedAt: changedAt },
      });

      revokedSessionCount = revokedSessions.count;
    }

    return { customer, revokedSessionCount };
  });

  await invalidateCustomerCache(userId);

  const [customerWithSessionStatus] = await attachCustomerSessionStatus([
    result.customer,
  ]);

  console.info("[admin] Customer access status updated", {
    requestedById,
    userId,
    isActive: nextIsActive,
    revokedSessionCount: result.revokedSessionCount,
  });

  return {
    ...customerWithSessionStatus,
    revokedSessionCount: result.revokedSessionCount,
  };
};

const bookingInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  },
  vehicle: true,
  garage: {
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  payment: true,
  services: {
    include: {
      service: {
        include: {
          category: true,
        },
      },
    },
  },
};

const listBookings = async (query = {}) => {
  const search = String(query.search || "").trim();
  const where = {
    ...(query.status && { status: query.status }),
    ...(query.garageId && { garageId: query.garageId }),
    ...(query.userId && { userId: query.userId }),
    ...(search && {
      OR: [
        { bookingCode: { contains: search, mode: "insensitive" } },
        { customerAddress: { contains: search, mode: "insensitive" } },
        {
          user: {
            is: { name: { contains: search, mode: "insensitive" } },
          },
        },
        {
          user: {
            is: { email: { contains: search, mode: "insensitive" } },
          },
        },
        {
          user: {
            is: { phone: { contains: search, mode: "insensitive" } },
          },
        },
        {
          garage: {
            is: { name: { contains: search, mode: "insensitive" } },
          },
        },
        {
          garage: {
            is: { city: { contains: search, mode: "insensitive" } },
          },
        },
        {
          garage: {
            is: { phone: { contains: search, mode: "insensitive" } },
          },
        },
        {
          vehicle: {
            is: { brand: { contains: search, mode: "insensitive" } },
          },
        },
        {
          vehicle: {
            is: { model: { contains: search, mode: "insensitive" } },
          },
        },
        {
          vehicle: {
            is: {
              registrationNumber: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    }),
  };

  return prisma.booking.findMany({
    where,
    include: bookingInclude,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
};

const getStartOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const getOperationsDashboard = async () => {
  const now = new Date();
  const startOfToday = getStartOfToday();
  const staleSearchCutoff = new Date(now.getTime() - 30 * 60 * 1000);
  const activeStatuses = ["GARAGE_ASSIGNED", "CONFIRMED", "IN_PROGRESS"];
  const operationalStatuses = [
    "SEARCHING_GARAGE",
    "GARAGE_ASSIGNED",
    "CONFIRMED",
    "IN_PROGRESS",
  ];

  const [
    activeBookings,
    pendingGarageResponses,
    vehiclesInService,
    delayedBookings,
    completedToday,
    failedPayments,
    pendingPayments,
    unresolvedComplaints,
    openSupportTickets,
    recentBookings,
    statusGroups,
  ] = await Promise.all([
    prisma.booking.count({ where: { status: { in: activeStatuses } } }),
    prisma.booking.count({ where: { status: "SEARCHING_GARAGE" } }),
    prisma.booking.count({ where: { status: "IN_PROGRESS" } }),
    prisma.booking.count({
      where: {
        status: { in: operationalStatuses },
        OR: [
          {
            status: "SEARCHING_GARAGE",
            createdAt: { lte: staleSearchCutoff },
          },
          {
            searchExpiresAt: { lt: now },
          },
          {
            scheduledDate: { lt: startOfToday },
          },
        ],
      },
    }),
    prisma.booking.count({
      where: {
        status: "COMPLETED",
        updatedAt: { gte: startOfToday },
      },
    }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.payment.count({ where: { status: "CREATED" } }),
    prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_REVIEW", "WAITING_CUSTOMER"] } },
    }),
    prisma.booking.findMany({
      where: { status: { in: operationalStatuses } },
      include: bookingInclude,
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.booking.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return {
    generatedAt: now,
    stats: {
      activeBookings,
      pendingGarageResponses,
      vehiclesInService,
      delayedBookings,
      completedToday,
      failedPayments,
      pendingPayments,
      unresolvedComplaints,
      openSupportTickets,
    },
    statusCounts: statusGroups.reduce((result, row) => {
      result[row.status] = row._count._all;
      return result;
    }, {}),
    recentBookings,
  };
};

const buildBookingTimeline = (booking) => {
  if (Array.isArray(booking.events) && booking.events.length) {
    return booking.events
      .map((event) => ({
        id: event.id,
        date: event.createdAt,
        title: event.title,
        detail: event.detail || "",
        type: event.actorType === "STAFF" ? "ADMIN" : event.eventType?.startsWith("PAYMENT") ? "PAYMENT" : event.eventType?.startsWith("GARAGE_REQUEST") ? "GARAGE_REQUEST" : "SYSTEM",
        eventType: event.eventType,
        previousValue: event.previousValue,
        nextValue: event.nextValue,
        metadata: {
          ...(event.metadata && typeof event.metadata === "object" ? event.metadata : {}),
          actorType: event.actorType,
          actorId: event.actorId,
          actorName: event.actorName,
          actorRole: event.actorRole,
          staffName: event.actorType === "STAFF" ? event.actorName : null,
        },
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  const events = [];
  const add = (date, title, detail = "", type = "SYSTEM", metadata = null) => {
    if (!date) return;
    events.push({
      id: `${type}:${title}:${new Date(date).toISOString()}:${events.length}`,
      date,
      title,
      detail,
      type,
      metadata,
    });
  };

  add(booking.createdAt, "Booking created", `Status: ${booking.status}`, "BOOKING");

  if (booking.payment) {
    add(
      booking.payment.createdAt,
      "Payment initiated",
      `₹${Number(booking.payment.amount || 0).toLocaleString("en-IN")}`,
      "PAYMENT",
    );
    if (booking.payment.updatedAt && booking.payment.updatedAt > booking.payment.createdAt) {
      add(
        booking.payment.updatedAt,
        `Payment ${String(booking.payment.status || "updated").toLowerCase()}`,
        booking.payment.cashfreePaymentId || booking.payment.cashfreeOrderId || "",
        "PAYMENT",
      );
    }
  }

  for (const request of booking.broadcasts || []) {
    add(
      request.sentAt || request.createdAt,
      `Request sent to ${request.garage?.name || "garage"}`,
      "",
      "GARAGE_REQUEST",
    );
    add(
      request.acceptedAt,
      `${request.garage?.name || "Garage"} accepted request`,
      request.garageResponseNote || "",
      "GARAGE_REQUEST",
    );
    add(
      request.rejectedAt,
      `${request.garage?.name || "Garage"} rejected request`,
      request.garageResponseNote || "",
      "GARAGE_REQUEST",
    );
    add(
      request.expiredAt,
      `Request to ${request.garage?.name || "garage"} expired`,
      "",
      "GARAGE_REQUEST",
    );
  }

  add(booking.acceptedAt, "Garage assigned", booking.garage?.name || "", "BOOKING");
  add(booking.handoverOtpVerifiedAt, "Vehicle handover verified", "", "BOOKING");
  add(booking.trackingStartedAt, "Service tracking started", "", "BOOKING");
  add(booking.deliveredAt, "Garage marked vehicle delivered", "", "BOOKING");
  add(booking.customerAcceptedAt, "Customer accepted delivery", "", "BOOKING");
  add(booking.expiredAt, "Booking expired", "", "BOOKING");

  for (const event of booking.adminEvents || []) {
    add(
      event.createdAt,
      event.action === "NOTE"
        ? "Internal admin note"
        : event.action === "STATUS_CHANGED"
          ? "Status changed by admin"
          : event.action === "GARAGE_REASSIGNED"
            ? "Garage reassigned by admin"
            : "Admin action",
      event.note || "",
      "ADMIN",
      {
        ...event.metadata,
        staffName: event.staffName,
        action: event.action,
      },
    );
  }

  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const getBookingDetails = async (bookingId) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      ...bookingInclude,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          customerProfile: true,
          locations: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          },
        },
      },
      broadcasts: {
        include: {
          garage: {
            select: {
              id: true,
              name: true,
              city: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      complaints: {
        orderBy: { createdAt: "desc" },
      },
      inspectionImages: {
        orderBy: [{ phase: "asc" }, { mediaType: "asc" }, { order: "asc" }],
      },
      review: true,
      adminEvents: {
        orderBy: { createdAt: "desc" },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 500,
      },
      reassignments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  return {
    ...booking,
    timeline: buildBookingTimeline(booking),
  };
};

const createAdminBookingEvent = async (tx, {
  bookingId,
  staff,
  action,
  note = "",
  metadata = undefined,
}) => {
  const cleanNote = String(note || "").trim().slice(0, 1000) || null;
  const staffName = staff.name || staff.loginId || staff.role || "Staff";
  const adminEvent = await tx.adminBookingEvent.create({
    data: {
      bookingId,
      staffId: staff.id,
      staffName,
      action,
      note: cleanNote,
      metadata,
    },
  });

  const timelineEvent = action === "NOTE"
    ? { eventType: "ADMIN_NOTE", title: "Internal staff note" }
    : action === "MANUAL_OVERRIDE"
      ? { eventType: "MANUAL_OVERRIDE", title: "Booking manually overridden" }
      : cleanNote && action === "STATUS_CHANGED"
        ? { eventType: "ADMIN_STATUS_NOTE", title: "Admin status-change note" }
        : cleanNote && action === "GARAGE_REASSIGNED"
          ? { eventType: "GARAGE_REASSIGNMENT_NOTE", title: "Garage reassignment reason" }
          : null;

  if (timelineEvent) {
    await tx.bookingEvent.create({
      data: {
        bookingId,
        actorType: "STAFF",
        actorId: staff.id,
        actorName: staffName,
        actorRole: staff.role,
        eventType: timelineEvent.eventType,
        title: timelineEvent.title,
        detail: cleanNote,
        metadata: {
          ...(metadata && typeof metadata === "object" ? metadata : {}),
          adminEventId: adminEvent.id,
        },
      },
    });
  }
  return adminEvent;
};

const updateBookingStatus = async ({ bookingId, status, note, staff }) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      bookingCode: true,
      status: true,
      garageId: true,
      garageControllerId: true,
      trackingStartedAt: true,
      trackingEndedAt: true,
      deliveredAt: true,
      expiredAt: true,
    },
  });

  if (!booking) throw new ApiError(404, "Booking not found");
  if (status === "GARAGE_ASSIGNED" && !booking.garageId) {
    throw new ApiError(400, "Assign a garage before setting GARAGE_ASSIGNED");
  }

  const now = new Date();
  const data = { status };
  if (status === "IN_PROGRESS" && !booking.trackingStartedAt) {
    data.trackingStartedAt = now;
  }
  if (status === "COMPLETED") {
    data.deliveredAt = booking.deliveredAt || now;
    data.trackingEndedAt = booking.trackingEndedAt || now;
  }
  if (status === "EXPIRED") data.expiredAt = booking.expiredAt || now;

  await prisma.$transaction(async (tx) => {
    await setBookingActorContext(tx, staff);
    await tx.booking.update({ where: { id: bookingId }, data });
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(status)) {
      await garageControllerService.releaseController(
        tx,
        booking.garageControllerId,
      );
    }
    await createAdminBookingEvent(tx, {
      bookingId,
      staff,
      action: "STATUS_CHANGED",
      note,
      metadata: { fromStatus: booking.status, toStatus: status },
    });
  });

  await invalidateCustomerCache(booking.userId);
  await notificationService.createNotification({
    userId: booking.userId,
    type: "BOOKING",
    title: "Booking status updated",
    message: `Booking ${booking.bookingCode} is now ${status.replaceAll("_", " ").toLowerCase()}.`,
    link: "/dashboard/bookings",
    metadata: { bookingId, status, updatedByAdmin: true },
  }).catch((error) => {
    console.warn("[admin-booking] status notification failed", {
      bookingId,
      message: error?.message || "Unknown notification error",
    });
  });

  return getBookingDetails(bookingId);
};

const reassignBookingGarage = async ({ bookingId, garageId, note, staff }) => {
  const [booking, garage] = await Promise.all([
    prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        bookingCode: true,
        garageId: true,
        garageControllerId: true,
        garage: { select: { name: true } },
      },
    }),
    prisma.garage.findFirst({
      where: { id: garageId, isActive: true, operationalStatus: "ACTIVE" },
      select: { id: true, name: true, city: true },
    }),
  ]);

  if (!booking) throw new ApiError(404, "Booking not found");
  if (!garage) throw new ApiError(404, "Active garage not found");
  if (booking.garageId === garageId) throw new ApiError(400, "This garage is already assigned to the booking");

  const now = new Date();
  let reassignmentId = null;
  await prisma.$transaction(async (tx) => {
    await setBookingActorContext(tx, staff);
    if (booking.garageId && booking.garageId !== garageId) {
      await tx.garageBroadcastRequest.updateMany({
        where: { bookingId, garageId: booking.garageId, status: "ACCEPTED" },
        data: { status: "EXPIRED", expiredAt: now },
      });
    }

    await tx.garageBroadcastRequest.upsert({
      where: { bookingId_garageId: { bookingId, garageId } },
      create: {
        bookingId,
        garageId,
        status: "ACCEPTED",
        acceptedAt: now,
        garageResponseNote: "Assigned by admin",
      },
      update: {
        status: "ACCEPTED",
        acceptedAt: now,
        rejectedAt: null,
        expiredAt: null,
        garageResponseNote: "Assigned by admin",
      },
    });

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        garageId,
        garageControllerId: null,
        status: "GARAGE_ASSIGNED",
        acceptedAt: now,
        searchExpiresAt: null,
        expiredAt: null,
      },
    });

    await garageControllerService.releaseController(
      tx,
      booking.garageControllerId,
    );

    const reassignment = await tx.bookingReassignment.create({
      data: {
        bookingId,
        previousGarageId: booking.garageId || null,
        previousGarageName: booking.garage?.name || null,
        newGarageId: garage.id,
        newGarageName: garage.name,
        reason: String(note || "").trim().slice(0, 1000) || null,
        actorId: staff.id,
        actorName: staff.name || staff.loginId || staff.role || "Staff",
        actorRole: staff.role,
      },
    });
    reassignmentId = reassignment.id;

    await createAdminBookingEvent(tx, {
      bookingId,
      staff,
      action: "GARAGE_REASSIGNED",
      note,
      metadata: {
        fromGarageId: booking.garageId,
        fromGarageName: booking.garage?.name || null,
        toGarageId: garage.id,
        toGarageName: garage.name,
      },
    });
  });

  await invalidateCustomerCache(booking.userId);
  await notificationService.createNotification({
    userId: booking.userId,
    type: "BOOKING",
    title: "Garage assigned",
    message: `${garage.name} has been assigned to booking ${booking.bookingCode}.`,
    link: "/dashboard/bookings",
    metadata: { bookingId, garageId, updatedByAdmin: true },
  }).then(async () => {
    if (reassignmentId) {
      await prisma.bookingReassignment.update({
        where: { id: reassignmentId },
        data: { customerNotified: true },
      }).catch(() => null);
    }
  }).catch((error) => {
    console.warn("[admin-booking] garage notification failed", {
      bookingId,
      message: error?.message || "Unknown notification error",
    });
  });

  return getBookingDetails(bookingId);
};

const addBookingAdminNote = async ({ bookingId, note, staff }) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true },
  });
  if (!booking) throw new ApiError(404, "Booking not found");

  await createAdminBookingEvent(prisma, {
    bookingId,
    staff,
    action: "NOTE",
    note,
  });

  return getBookingDetails(bookingId);
};


const normalizeNullableDate = (value) => {
  if (value === null || value === "") return null;
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Invalid date value");
  return date;
};

const manualOverrideBooking = async ({ bookingId, payload, staff }) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { services: true },
  });
  if (!booking) throw new ApiError(404, "Booking not found");

  const reason = String(payload.reason || "").trim().slice(0, 1000);
  if (reason.length < 5) throw new ApiError(400, "A clear override reason is required");

  const data = {};
  const copyText = (key, max = 500) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      data[key] = payload[key] === null ? null : String(payload[key] || "").trim().slice(0, max) || null;
    }
  };
  const copyNumber = (key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      data[key] = payload[key] === null || payload[key] === "" ? null : Number(payload[key]);
    }
  };
  copyText("startTime", 20);
  copyText("endTime", 20);
  copyText("customerAddress", 500);
  copyNumber("customerLatitude");
  copyNumber("customerLongitude");
  for (const key of ["handlingFee", "payableAmount", "totalServiceAmount", "totalServiceMaxAmount"]) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) data[key] = Number(payload[key]);
  }
  for (const key of ["scheduledDate", "searchExpiresAt", "acceptedAt", "deliveredAt", "customerAcceptedAt"]) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) data[key] = normalizeNullableDate(payload[key]);
  }

  const servicePrices = Array.isArray(payload.servicePrices) ? payload.servicePrices : [];
  if (!Object.keys(data).length && !servicePrices.length) {
    throw new ApiError(400, "Provide at least one booking field to override");
  }

  await prisma.$transaction(async (tx) => {
    await setBookingActorContext(tx, staff);
    if (Object.keys(data).length) await tx.booking.update({ where: { id: bookingId }, data });
    for (const item of servicePrices) {
      const existing = booking.services.find((service) => service.id === item.bookingServiceId);
      if (!existing) throw new ApiError(400, "A selected booking service does not belong to this booking");
      await tx.bookingService.update({
        where: { id: existing.id },
        data: { finalPrice: item.finalPrice === null || item.finalPrice === "" ? null : Number(item.finalPrice) },
      });
    }
    await createAdminBookingEvent(tx, {
      bookingId,
      staff,
      action: "MANUAL_OVERRIDE",
      note: reason,
      metadata: { changedFields: Object.keys(data), servicePriceCount: servicePrices.length },
    });
  });

  await invalidateCustomerCache(booking.userId);
  return getBookingDetails(bookingId);
};

const getCustomerProfile = async (userId) => {
  const now = new Date();
  const customer = await prisma.user.findFirst({
    where: { id: userId, role: "CUSTOMER" },
    select: {
      ...userSelect,
      wallet: true,
      vehicles: { orderBy: { createdAt: "desc" } },
      bookings: {
        include: bookingInclude,
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      complaints: {
        include: {
          booking: { select: { id: true, bookingCode: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      supportTickets: {
        include: {
          booking: { select: { id: true, bookingCode: true } },
          supportAssignee: { select: { id: true, name: true, email: true } },
          _count: { select: { messages: true, attachments: true } },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 20,
      },
      customerActivities: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      sessions: {
        orderBy: { lastSeenAt: "desc" },
        take: 30,
      },
      walletTransactions: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!customer) throw new ApiError(404, "Customer not found");

  const [
    statusGroups,
    serviceSpend,
    platformFeeSpend,
    reviewCount,
    complaintCount,
    supportTicketCount,
  ] = await Promise.all([
    prisma.booking.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.booking.aggregate({
      where: {
        userId,
        status: "COMPLETED",
      },
      _sum: { totalServiceAmount: true },
    }),
    prisma.payment.aggregate({
      where: {
        booking: { is: { userId } },
        status: "PAID",
      },
      _sum: { amount: true },
    }),
    prisma.review.count({ where: { userId } }),
    prisma.complaint.count({ where: { userId } }),
    prisma.supportTicket.count({ where: { userId } }),
  ]);

  const [withSessionStatus] = await attachCustomerSessionStatus([customer]);
  const sessions = (customer.sessions || []).map((session) => ({
    ...session,
    isActive: !session.revokedAt && session.expiresAt > now,
  }));

  return {
    ...withSessionStatus,
    sessions,
    summary: {
      bookingStatusCounts: statusGroups.reduce((result, row) => {
        result[row.status] = row._count._all;
        return result;
      }, {}),
      completedServiceSpend: serviceSpend._sum.totalServiceAmount || 0,
      platformFeeSpend: platformFeeSpend._sum.amount || 0,
      totalSpend:
        Number(serviceSpend._sum.totalServiceAmount || 0) +
        Number(platformFeeSpend._sum.amount || 0),
      complaintCount,
      supportTicketCount,
      reviewCount,
    },
  };
};


const PAYMENT_RECORD_TYPES = {
  CUSTOMER_PLATFORM_FEE: "CUSTOMER_PLATFORM_FEE",
  CUSTOMER_WALLET_RECHARGE: "CUSTOMER_WALLET_RECHARGE",
  CUSTOMER_WALLET_PAYMENT: "CUSTOMER_WALLET_PAYMENT",
  CUSTOMER_SOS_CHARGE: "CUSTOMER_SOS_CHARGE",
  GARAGE_WALLET_RECHARGE: "GARAGE_WALLET_RECHARGE",
  GARAGE_PLATFORM_FEE: "GARAGE_PLATFORM_FEE",
  ADMIN_CUSTOMER_WALLET_CREDIT: "ADMIN_CUSTOMER_WALLET_CREDIT",
  ADMIN_GARAGE_WALLET_CREDIT: "ADMIN_GARAGE_WALLET_CREDIT",
};

const PAYMENT_STATUSES = ["CREATED", "PAID", "FAILED", "REFUNDED"];
const WALLET_STATUSES = ["PENDING", "SUCCESS", "FAILED"];
const SUCCESS_STATUSES = new Set(["PAID", "SUCCESS"]);

const toDateRangeFilter = ({ from, to } = {}) => {
  const createdAt = {};

  if (from) {
    const startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);
    createdAt.gte = startDate;
  }

  if (to) {
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
    createdAt.lte = endDate;
  }

  return Object.keys(createdAt).length ? { createdAt } : {};
};

const containsSearch = (search) => ({
  contains: search,
  mode: "insensitive",
});

const getBookingServiceNames = (booking = {}) =>
  (booking.services || [])
    .map((item) => item.service?.name || item.service?.category?.name)
    .filter(Boolean);

const getCustomerPaymentMethod = (payment = {}) => {
  const walletAmount = Number(payment.walletAmountUsed || 0);
  const upiAmount =
    Number(payment.upiAmountPaid || 0) ||
    (walletAmount > 0 ? 0 : Number(payment.amount || 0));

  if (walletAmount > 0 && upiAmount > 0) return "Wallet + Cashfree";
  if (walletAmount > 0) return "Wallet";
  return "Cashfree";
};

const normalizePaymentRecord = (payment) => ({
  id: `payment:${payment.id}`,
  source: "Payment",
  sourceId: payment.id,
  type: PAYMENT_RECORD_TYPES.CUSTOMER_PLATFORM_FEE,
  title: "Customer booking platform fee",
  amount: payment.amount || 0,
  currency: payment.currency || "INR",
  status: payment.status,
  method: getCustomerPaymentMethod(payment),
  cashfreeOrderId: payment.cashfreeOrderId,
  cashfreePaymentId: payment.cashfreePaymentId,
  walletAmountUsed: payment.walletAmountUsed || 0,
  upiAmountPaid: payment.upiAmountPaid || 0,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
  customer: payment.booking?.user
    ? {
        id: payment.booking.user.id,
        name: payment.booking.user.name,
        email: payment.booking.user.email,
        phone: payment.booking.user.phone,
      }
    : null,
  garage: payment.booking?.garage
    ? {
        id: payment.booking.garage.id,
        name: payment.booking.garage.name,
        city: payment.booking.garage.city,
        email: payment.booking.garage.email,
        phone: payment.booking.garage.phone,
      }
    : null,
  booking: payment.booking
    ? {
        id: payment.booking.id,
        code: payment.booking.bookingCode,
        status: payment.booking.status,
        totalServiceAmount: payment.booking.totalServiceAmount,
        payableAmount: payment.booking.payableAmount,
        services: getBookingServiceNames(payment.booking),
        vehicle: payment.booking.vehicle
          ? {
              brand: payment.booking.vehicle.brand,
              model: payment.booking.vehicle.model,
              registrationNumber: payment.booking.vehicle.registrationNumber,
            }
          : null,
      }
    : null,
});

const normalizeCustomerWalletRecord = (transaction) => {
  const typeMap = {
    RECHARGE: PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE,
    BOOKING_PAYMENT: PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_PAYMENT,
    SOS_DEDUCTION: PAYMENT_RECORD_TYPES.CUSTOMER_SOS_CHARGE,
    CREDIT: PAYMENT_RECORD_TYPES.ADMIN_CUSTOMER_WALLET_CREDIT,
  };

  return {
    id: `customer-wallet:${transaction.id}`,
    source: "WalletTransaction",
    sourceId: transaction.id,
    type: typeMap[transaction.type] || PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_PAYMENT,
    title: transaction.description || transaction.type,
    amount: transaction.amount || 0,
    currency: "INR",
    status: transaction.status,
    method: transaction.cashfreeOrderId ? "Cashfree" : "Customer Wallet",
    cashfreeOrderId: transaction.cashfreeOrderId,
    cashfreePaymentId: transaction.cashfreePaymentId,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description,
    createdAt: transaction.createdAt,
    updatedAt: transaction.createdAt,
    customer: transaction.user
      ? {
          id: transaction.user.id,
          name: transaction.user.name,
          email: transaction.user.email,
          phone: transaction.user.phone,
        }
      : null,
    garage: null,
    booking: null,
  };
};

const normalizeGarageWalletRecord = (transaction) => {
  const isRecharge = transaction.type === "RECHARGE";
  const isAdminCredit = transaction.type === "CREDIT";

  return {
    id: `garage-wallet:${transaction.id}`,
    source: "GarageWalletTransaction",
    sourceId: transaction.id,
    type: isAdminCredit
      ? PAYMENT_RECORD_TYPES.ADMIN_GARAGE_WALLET_CREDIT
      : isRecharge
        ? PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE
        : PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE,
    title: transaction.description || transaction.type,
    amount: transaction.amount || 0,
    currency: "INR",
    status: transaction.status,
    method: isRecharge ? "Cashfree" : "Garage Wallet",
    cashfreeOrderId: transaction.cashfreeOrderId,
    cashfreePaymentId: transaction.cashfreePaymentId,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description,
    createdAt: transaction.createdAt,
    updatedAt: transaction.createdAt,
    customer: null,
    garage: transaction.garage
      ? {
          id: transaction.garage.id,
          name: transaction.garage.name,
          city: transaction.garage.city,
          email: transaction.garage.email,
          phone: transaction.garage.phone,
          ownerName: transaction.garage.owner?.name,
          ownerEmail: transaction.garage.owner?.email,
          ownerPhone: transaction.garage.owner?.phone,
        }
      : null,
    booking: null,
  };
};

const buildPaymentSearchWhere = (search) => {
  if (!search) return {};

  const match = containsSearch(search);

  return {
    OR: [
      { cashfreeOrderId: match },
      { cashfreePaymentId: match },
      {
        booking: {
          is: {
            bookingCode: match,
          },
        },
      },
      {
        booking: {
          is: {
            user: {
              is: { name: match },
            },
          },
        },
      },
      {
        booking: {
          is: {
            user: {
              is: { email: match },
            },
          },
        },
      },
      {
        booking: {
          is: {
            user: {
              is: { phone: match },
            },
          },
        },
      },
      {
        booking: {
          is: {
            garage: {
              is: { name: match },
            },
          },
        },
      },
    ],
  };
};

const buildCustomerWalletSearchWhere = (search) => {
  if (!search) return {};

  const match = containsSearch(search);

  return {
    OR: [
      { cashfreeOrderId: match },
      { cashfreePaymentId: match },
      { description: match },
      { user: { is: { name: match } } },
      { user: { is: { email: match } } },
      { user: { is: { phone: match } } },
    ],
  };
};

const buildGarageWalletSearchWhere = (search) => {
  if (!search) return {};

  const match = containsSearch(search);

  return {
    OR: [
      { cashfreeOrderId: match },
      { cashfreePaymentId: match },
      { description: match },
      { garage: { is: { name: match } } },
      { garage: { is: { email: match } } },
      { garage: { is: { phone: match } } },
      { garage: { is: { owner: { is: { name: match } } } } },
      { garage: { is: { owner: { is: { email: match } } } } },
      { garage: { is: { owner: { is: { phone: match } } } } },
    ],
  };
};

const getCustomerWalletTypeFilter = (paymentType) => {
  if (paymentType === PAYMENT_RECORD_TYPES.ADMIN_CUSTOMER_WALLET_CREDIT) {
    return { type: "CREDIT" };
  }
  if (paymentType === PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE) {
    return { type: "RECHARGE" };
  }

  if (paymentType === PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_PAYMENT) {
    return { type: "BOOKING_PAYMENT" };
  }

  if (paymentType === PAYMENT_RECORD_TYPES.CUSTOMER_SOS_CHARGE) {
    return { type: "SOS_DEDUCTION" };
  }

  return { type: { in: ["RECHARGE", "BOOKING_PAYMENT", "SOS_DEDUCTION", "CREDIT"] } };
};

const getGarageWalletTypeFilter = (paymentType) => {
  if (paymentType === PAYMENT_RECORD_TYPES.ADMIN_GARAGE_WALLET_CREDIT) {
    return { type: "CREDIT" };
  }
  if (paymentType === PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE) {
    return { type: "RECHARGE" };
  }

  if (paymentType === PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE) {
    return { type: "GARAGE_ACCEPT_FEE" };
  }

  return { type: { in: ["RECHARGE", "GARAGE_ACCEPT_FEE", "CREDIT"] } };
};

const shouldFetchPaymentRows = (paymentType) =>
  !paymentType || paymentType === PAYMENT_RECORD_TYPES.CUSTOMER_PLATFORM_FEE;

const shouldFetchCustomerWalletRows = (paymentType) =>
  !paymentType ||
  [
    PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE,
    PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_PAYMENT,
    PAYMENT_RECORD_TYPES.CUSTOMER_SOS_CHARGE,
    PAYMENT_RECORD_TYPES.ADMIN_CUSTOMER_WALLET_CREDIT,
  ].includes(paymentType);

const shouldFetchGarageWalletRows = (paymentType) =>
  !paymentType ||
  [
    PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE,
    PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE,
    PAYMENT_RECORD_TYPES.ADMIN_GARAGE_WALLET_CREDIT,
  ].includes(paymentType);

const getPaymentSummary = (records = []) =>
  records.reduce(
    (summary, record) => {
      const amount = Number(record.amount || 0);
      const isSuccessful = SUCCESS_STATUSES.has(record.status);

      summary.totalRecords += 1;

      if (!isSuccessful) {
        return summary;
      }

      summary.successfulAmount += amount;

      if (record.type === PAYMENT_RECORD_TYPES.CUSTOMER_PLATFORM_FEE) {
        summary.customerPlatformFee += amount;
        summary.totalPlatformRevenue += amount;
      } else if (record.type === PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE) {
        summary.garagePlatformFee += amount;
        summary.totalPlatformRevenue += amount;
      } else if (
        record.type === PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE ||
        record.type === PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE
      ) {
        summary.walletRecharges += amount;
      }

      return summary;
    },
    {
      totalRecords: 0,
      successfulAmount: 0,
      customerPlatformFee: 0,
      garagePlatformFee: 0,
      totalPlatformRevenue: 0,
      walletRecharges: 0,
    },
  );

const emptyPaymentSummary = () => ({
  totalRecords: 0,
  successfulAmount: 0,
  customerPlatformFee: 0,
  garagePlatformFee: 0,
  totalPlatformRevenue: 0,
  walletRecharges: 0,
});

const getAggregateSum = (result) => Number(result?._sum?.amount || 0);

const getFullPaymentSummary = async ({
  type,
  status,
  search,
  dateRangeFilter,
  canFetchPaymentStatus,
  canFetchWalletStatus,
}) => {
  const summary = emptyPaymentSummary();
  const paymentWhere = {
    ...dateRangeFilter,
    ...(status && PAYMENT_STATUSES.includes(status) ? { status } : {}),
    ...buildPaymentSearchWhere(search),
  };
  const customerWalletWhere = {
    ...dateRangeFilter,
    ...getCustomerWalletTypeFilter(type),
    ...(status && WALLET_STATUSES.includes(status) ? { status } : {}),
    ...buildCustomerWalletSearchWhere(search),
  };
  const garageWalletWhere = {
    ...dateRangeFilter,
    ...getGarageWalletTypeFilter(type),
    ...(status && WALLET_STATUSES.includes(status) ? { status } : {}),
    ...buildGarageWalletSearchWhere(search),
  };

  const countPromises = [];

  if (shouldFetchPaymentRows(type) && canFetchPaymentStatus) {
    countPromises.push(prisma.payment.count({ where: paymentWhere }));
  }

  if (shouldFetchCustomerWalletRows(type) && canFetchWalletStatus) {
    countPromises.push(prisma.walletTransaction.count({ where: customerWalletWhere }));
  }

  if (shouldFetchGarageWalletRows(type) && canFetchWalletStatus) {
    countPromises.push(prisma.garageWalletTransaction.count({ where: garageWalletWhere }));
  }

  const counts = await Promise.all(countPromises);
  summary.totalRecords = counts.reduce((sum, count) => sum + Number(count || 0), 0);

  const sumPromises = [];
  const addSumPromise = (key, promise) => {
    sumPromises.push(
      promise.then((result) => ({ key, amount: getAggregateSum(result) })),
    );
  };

  if (shouldFetchPaymentRows(type) && (!status || status === "PAID")) {
    addSumPromise(
      "customerPlatformFee",
      prisma.payment.aggregate({
        where: { ...paymentWhere, status: "PAID" },
        _sum: { amount: true },
      }),
    );
  }

  if (shouldFetchCustomerWalletRows(type) && (!status || status === "SUCCESS")) {
    addSumPromise(
      "customerWalletSuccessful",
      prisma.walletTransaction.aggregate({
        where: { ...customerWalletWhere, status: "SUCCESS" },
        _sum: { amount: true },
      }),
    );

    if (
      !type ||
      type === PAYMENT_RECORD_TYPES.CUSTOMER_WALLET_RECHARGE
    ) {
      addSumPromise(
        "walletRecharges",
        prisma.walletTransaction.aggregate({
          where: {
            ...dateRangeFilter,
            type: "RECHARGE",
            status: "SUCCESS",
            ...buildCustomerWalletSearchWhere(search),
          },
          _sum: { amount: true },
        }),
      );
    }
  }

  if (shouldFetchGarageWalletRows(type) && (!status || status === "SUCCESS")) {
    addSumPromise(
      "garageWalletSuccessful",
      prisma.garageWalletTransaction.aggregate({
        where: { ...garageWalletWhere, status: "SUCCESS" },
        _sum: { amount: true },
      }),
    );

    if (!type || type === PAYMENT_RECORD_TYPES.GARAGE_PLATFORM_FEE) {
      addSumPromise(
        "garagePlatformFee",
        prisma.garageWalletTransaction.aggregate({
          where: {
            ...dateRangeFilter,
            type: "GARAGE_ACCEPT_FEE",
            status: "SUCCESS",
            ...buildGarageWalletSearchWhere(search),
          },
          _sum: { amount: true },
        }),
      );
    }

    if (!type || type === PAYMENT_RECORD_TYPES.GARAGE_WALLET_RECHARGE) {
      addSumPromise(
        "walletRecharges",
        prisma.garageWalletTransaction.aggregate({
          where: {
            ...dateRangeFilter,
            type: "RECHARGE",
            status: "SUCCESS",
            ...buildGarageWalletSearchWhere(search),
          },
          _sum: { amount: true },
        }),
      );
    }
  }

  const sums = await Promise.all(sumPromises);

  sums.forEach(({ key, amount }) => {
    if (key === "customerPlatformFee") {
      summary.customerPlatformFee += amount;
      summary.totalPlatformRevenue += amount;
      summary.successfulAmount += amount;
    } else if (key === "garagePlatformFee") {
      summary.garagePlatformFee += amount;
      summary.totalPlatformRevenue += amount;
    } else if (key === "walletRecharges") {
      summary.walletRecharges += amount;
    } else {
      summary.successfulAmount += amount;
    }
  });

  return summary;
};

const listPayments = async (query = {}) => {
  const limit = Math.min(Math.max(Number(query.limit || 250), 1), 500);
  const type = String(query.type || "").trim();
  const status = String(query.status || "").trim();
  const search = String(query.search || "").trim();
  const dateRangeFilter = toDateRangeFilter(query);
  const take = limit;
  const canFetchPaymentStatus = !status || PAYMENT_STATUSES.includes(status);
  const canFetchWalletStatus = !status || WALLET_STATUSES.includes(status);

  const paymentPromise = shouldFetchPaymentRows(type) && canFetchPaymentStatus
    ? prisma.payment.findMany({
        where: {
          ...dateRangeFilter,
          ...(status && PAYMENT_STATUSES.includes(status)
            ? { status }
            : {}),
          ...buildPaymentSearchWhere(search),
        },
        include: {
          booking: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true } },
              garage: true,
              vehicle: true,
              services: { include: { service: { include: { category: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      })
    : Promise.resolve([]);

  const customerWalletPromise =
    shouldFetchCustomerWalletRows(type) && canFetchWalletStatus
      ? prisma.walletTransaction.findMany({
        where: {
          ...dateRangeFilter,
          ...getCustomerWalletTypeFilter(type),
          ...(status && WALLET_STATUSES.includes(status)
            ? { status }
            : {}),
          ...buildCustomerWalletSearchWhere(search),
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
      })
    : Promise.resolve([]);

  const garageWalletPromise =
    shouldFetchGarageWalletRows(type) && canFetchWalletStatus
      ? prisma.garageWalletTransaction.findMany({
        where: {
          ...dateRangeFilter,
          ...getGarageWalletTypeFilter(type),
          ...(status && WALLET_STATUSES.includes(status)
            ? { status }
            : {}),
          ...buildGarageWalletSearchWhere(search),
        },
        include: {
          garage: {
            include: {
              owner: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      })
    : Promise.resolve([]);

  const [payments, customerWalletTransactions, garageWalletTransactions] =
    await Promise.all([
      paymentPromise,
      customerWalletPromise,
      garageWalletPromise,
    ]);

  const records = [
    ...payments.map(normalizePaymentRecord),
    ...customerWalletTransactions.map(normalizeCustomerWalletRecord),
    ...garageWalletTransactions.map(normalizeGarageWalletRecord),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);

  return {
    records,
    summary: await getFullPaymentSummary({
      type,
      status,
      search,
      dateRangeFilter,
      canFetchPaymentStatus,
      canFetchWalletStatus,
    }),
  };
};

const searchWalletTransferRecipients = async ({ type, search = "" } = {}) => {
  const term = String(search).trim();
  const match = term ? { contains: term, mode: "insensitive" } : undefined;

  if (type === "CUSTOMER") {
    const customers = await prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        isActive: true,
        ...(match && { OR: [{ name: match }, { email: match }, { phone: match }] }),
      },
      select: { id: true, name: true, email: true, phone: true, wallet: { select: { balance: true } } },
      orderBy: { name: "asc" },
      take: 20,
    });
    return customers.map(({ wallet, ...customer }) => ({
      ...customer,
      recipientType: "CUSTOMER",
      walletBalance: wallet?.balance || 0,
    }));
  }

  const garages = await prisma.garage.findMany({
    where: {
      ownerId: { not: null },
      owner: { is: { isActive: true } },
      ...(match && {
        OR: [
          { name: match }, { email: match }, { phone: match },
          { owner: { is: { name: match } } },
          { owner: { is: { email: match } } },
          { owner: { is: { phone: match } } },
        ],
      }),
    },
    select: {
      id: true, name: true, email: true, phone: true,
      owner: { select: { id: true, name: true, email: true, phone: true } },
      wallet: { select: { balance: true } },
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  return garages.map(({ wallet, owner, ...garage }) => ({
    ...garage,
    owner,
    recipientType: "GARAGE_OWNER",
    walletBalance: wallet?.balance || 0,
  }));
};

const transferWalletFunds = async ({ recipientType, recipientId, amount, note, requestId, staff }) => {
  const description = `Admin wallet credit: ${String(note).trim()}`;

  if (recipientType === "CUSTOMER") {
    const customer = await prisma.user.findFirst({
      where: { id: recipientId, role: "CUSTOMER", isActive: true },
      select: { id: true, name: true },
    });
    if (!customer) throw new ApiError(404, "Active customer not found");

    const existing = await prisma.walletTransaction.findUnique({ where: { idempotencyKey: requestId } });
    if (existing) {
      if (existing.userId !== customer.id || existing.amount !== amount) {
        throw new ApiError(409, "Transfer request ID was already used");
      }
      return { recipientType, recipient: customer, transaction: existing, duplicate: true };
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: customer.id },
        update: { balance: { increment: amount } },
        create: { userId: customer.id, type: "CUSTOMER", balance: amount },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id, userId: customer.id, type: "CREDIT", status: "SUCCESS",
          amount, balanceAfter: wallet.balance, description, idempotencyKey: requestId,
        },
      });
      return { wallet, transaction };
    });
    await invalidateCustomerCache(customer.id);
    await notificationService.createNotification({
      userId: customer.id,
      title: "Wallet credited",
      message: `Rs. ${amount.toLocaleString("en-IN")} was added to your Rovauto wallet.`,
      type: "PAYMENT",
      link: "/wallet",
      metadata: { transactionId: result.transaction.id },
    });
    console.info("[admin] Customer wallet credited", { staffId: staff.id, userId: customer.id, amount, requestId });
    return { recipientType, recipient: customer, ...result, duplicate: false };
  }

  const garage = await prisma.garage.findFirst({
    where: { id: recipientId, ownerId: { not: null }, owner: { is: { isActive: true } } },
    select: { id: true, name: true, ownerId: true },
  });
  if (!garage) throw new ApiError(404, "Active garage owner not found");

  const existing = await prisma.garageWalletTransaction.findUnique({ where: { idempotencyKey: requestId } });
  if (existing) {
    if (existing.garageId !== garage.id || existing.amount !== amount) {
      throw new ApiError(409, "Transfer request ID was already used");
    }
    return { recipientType, recipient: garage, transaction: existing, duplicate: true };
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.garageWallet.upsert({
      where: { garageId: garage.id },
      update: { balance: { increment: amount } },
      create: { garageId: garage.id, balance: amount },
    });
    const transaction = await tx.garageWalletTransaction.create({
      data: {
        garageWalletId: wallet.id, garageId: garage.id, type: "CREDIT", status: "SUCCESS",
        amount, balanceAfter: wallet.balance, description, idempotencyKey: requestId,
      },
    });
    return { wallet, transaction };
  });
  await notificationService.createNotification({
    garageOwnerId: garage.ownerId,
    title: "Wallet credited",
    message: `Rs. ${amount.toLocaleString("en-IN")} was added to your garage wallet.`,
    type: "PAYMENT",
    link: "/garage/wallet",
    metadata: { transactionId: result.transaction.id, garageId: garage.id },
  });
  console.info("[admin] Garage wallet credited", { staffId: staff.id, garageId: garage.id, amount, requestId });
  return { recipientType, recipient: garage, ...result, duplicate: false };
};

const getDashboardStats = async () => {
  const [
    garages,
    activeGarages,
    pendingApplications,
    priceRanges,
    customers,
    bookings,
    totalServiceCost,
    customerPlatformFeeRevenue,
    garagePlatformFeeRevenue,
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
    prisma.booking.aggregate({
      where: {
        status: "COMPLETED",
        customerAcceptedAt: { not: null },
      },
      _sum: { totalServiceAmount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.garageWalletTransaction.aggregate({
      where: {
        type: "GARAGE_ACCEPT_FEE",
        status: "SUCCESS",
      },
      _sum: { amount: true },
    }),
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
      totalServiceCost: totalServiceCost._sum.totalServiceAmount || 0,
      customerPlatformFeeRevenue: customerPlatformFeeRevenue._sum.amount || 0,
      garagePlatformFeeRevenue: garagePlatformFeeRevenue._sum.amount || 0,
      totalPlatformRevenue:
        Number(customerPlatformFeeRevenue._sum.amount || 0) +
        Number(garagePlatformFeeRevenue._sum.amount || 0),
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
  const searchWhere = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};
  const select = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    isActive: true,
    createdAt: true,
  };
  const [customers, garageOwners] = await Promise.all([
    query.role === "GARAGE_OWNER"
      ? []
      : prisma.user.findMany({
          where: { role: "CUSTOMER", ...searchWhere },
          select,
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
    query.role === "CUSTOMER"
      ? []
      : prisma.garageOwner.findMany({
          where: searchWhere,
          select,
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
  ]);

  return [...customers, ...garageOwners]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 25);
};

const sendUserEmail = async ({ userId, subject, message }) => {
  if (!process.env.RESEND_API_KEY || !resend) {
    throw new ApiError(500, "Resend API key missing");
  }

  const user =
    (await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    })) ||
    (await prisma.garageOwner.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    }));

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
    const users = await prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        isActive: true,
      },
      select: { id: true },
    });

    const userIds = users.map((user) => user.id);
    if (userIds.length === 0) {
      return { sent: 0, audience: "ALL" };
    }

    await prisma.notification.createMany({
      data: userIds.map((recipientUserId) => ({
        userId: recipientUserId,
        title,
        message,
        type,
        link,
        metadata: { audience: "ALL" },
      })),
    });

    await Promise.all([
      invalidateUsersNotificationCache(userIds),
      notificationService.sendPushToUsers(userIds, {
        title,
        message,
        type,
        link,
        metadata: { audience: "ALL" },
      }),
    ]);

    return { sent: userIds.length, audience: "ALL" };
  }

  if (audience === "USER") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const garageOwner = user
      ? null
      : await prisma.garageOwner.findUnique({ where: { id: userId } });
    if (!user && !garageOwner) throw new ApiError(404, "User not found");

    return notificationService.createNotification({
      userId: user ? userId : null,
      garageOwnerId: garageOwner ? userId : null,
      title,
      message,
      type,
      link,
      metadata: { audience: "USER" },
    });
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
    const userIds = users.map((user) => user.id);
    await Promise.all([
      invalidateUsersNotificationCache(userIds),
      notificationService.sendPushToUsers(userIds, {
        title,
        message,
        type,
        link,
        metadata: { audience: "CITY", city },
      }),
    ]);
    return { sent: users.length, city };
  }

  throw new ApiError(400, "Audience must be ALL, CITY, or USER");
};


const CLEAR_BOOKINGS_CONFIRMATION = "CLEAR ALL BOOKINGS";
const CLOUDINARY_DELETE_BATCH_SIZE = 10;

const deleteInspectionMediaFromCloudinary = async (records = []) => {
  const uniqueAssets = [
    ...new Map(
      records
        .filter((record) => record?.publicId)
        .map((record) => {
          const resourceType = record.mediaType === "VIDEO" ? "video" : "image";
          return [
            `${resourceType}:${record.publicId}`,
            { publicId: record.publicId, resourceType },
          ];
        }),
    ).values(),
  ];

  let deleted = 0;
  let failed = 0;

  for (
    let index = 0;
    index < uniqueAssets.length;
    index += CLOUDINARY_DELETE_BATCH_SIZE
  ) {
    const batch = uniqueAssets.slice(
      index,
      index + CLOUDINARY_DELETE_BATCH_SIZE,
    );

    const results = await Promise.allSettled(
      batch.map((asset) =>
        deleteFromCloudinary(asset.publicId, asset.resourceType),
      ),
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        deleted += 1;
      } else {
        failed += 1;
      }
    });
  }

  return {
    requested: uniqueAssets.length,
    deleted,
    failed,
  };
};

const clearAllBookings = async ({
  confirmation,
  requestedById = null,
} = {}) => {
  if (confirmation !== CLEAR_BOOKINGS_CONFIRMATION) {
    throw new ApiError(
      400,
      `Type ${CLEAR_BOOKINGS_CONFIRMATION} to continue`,
    );
  }

  const [
    bookingCount,
    payments,
    bookingServices,
    broadcasts,
    inspectionImageRecords,
    reviews,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.payment.count(),
    prisma.bookingService.count(),
    prisma.garageBroadcastRequest.count(),
    prisma.bookingInspectionImage.findMany({
      select: {
        publicId: true,
        mediaType: true,
      },
    }),
    prisma.review.count(),
  ]);

  if (bookingCount === 0) {
    return {
      deletedBookings: 0,
      complaintsDetached: 0,
      deletedRelatedRecords: {
        payments: 0,
        bookingServices: 0,
        broadcasts: 0,
        inspectionImages: 0,
        reviews: 0,
      },
      cloudinaryInspectionImages: {
        requested: 0,
        deleted: 0,
        failed: 0,
      },
    };
  }

  const deletionResult = await prisma.$transaction(
    async (tx) => {
      const detachedComplaints =
        await tx.complaint.updateMany({
          where: {
            bookingId: {
              not: null,
            },
          },
          data: {
            bookingId: null,
          },
        });

      const deletedBookings =
        await tx.booking.deleteMany();

      return {
        deletedBookings: deletedBookings.count,
        complaintsDetached: detachedComplaints.count,
      };
    },
    {
      timeout: 60000,
    },
  );

  await Promise.allSettled([
    deletePattern("customer:*"),
  ]);

  const cloudinaryInspectionImages =
    await deleteInspectionMediaFromCloudinary(inspectionImageRecords);

  console.info("[admin] All bookings cleared", {
    requestedById,
    ...deletionResult,
  });

  return {
    ...deletionResult,
    deletedRelatedRecords: {
      payments,
      bookingServices,
      broadcasts,
      inspectionImages: inspectionImageRecords.length,
      reviews,
    },
    cloudinaryInspectionImages,
  };
};

module.exports = {
  addBookingAdminNote,
  clearAllBookings,
  deleteCustomers,
  setCustomerActiveStatus,
  getBookingDetails,
  getCustomerProfile,
  getDashboardStats,
  getOperationsDashboard,
  listPayments,
  manualOverrideBooking,
  searchWalletTransferRecipients,
  listBookings,
  listCustomers,
  listVehicles,
  lookupVehicleRegistration,
  reassignBookingGarage,
  searchEmailUsers,
  sendUserEmail,
  sendNotification,
  updateBookingStatus,
  transferWalletFunds,
};
