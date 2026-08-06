const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deletePattern } = require("../../utils/cache");
const invalidateCustomerCache = require("../../utils/invalidateCustomerCache");
const garageRequestService = require("../../services/garageRequest.service");
const notificationService = require("./notification.service");
const supportNotificationService = require("../../customerSupport/services/supportNotification.service");
const emailService = require("./firstBookingVerificationEmail.service");

const FIRST_BOOKING_MAX_ESTIMATE = Math.max(
  1,
  Number(process.env.FIRST_BOOKING_FREE_MAX_ESTIMATE || 5000),
);
const LEAD_ESCALATION_MINUTES = Math.max(
  1,
  Number(process.env.FIRST_BOOKING_LEAD_ESCALATION_MINUTES || 2),
);

const LEAD_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  },
  claimedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
    },
  },
  booking: {
    select: {
      id: true,
      bookingCode: true,
      status: true,
      fulfillmentType: true,
      customerAddress: true,
      totalServiceAmount: true,
      totalServiceMaxAmount: true,
      handlingFee: true,
      payableAmount: true,
      createdAt: true,
      vehicle: {
        select: {
          id: true,
          brand: true,
          model: true,
          fuelType: true,
          registrationNumber: true,
        },
      },
      services: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
};


const CUSTOMER_LEAD_INCLUDE = {
  booking: LEAD_INCLUDE.booking,
};

const getFrontendBaseUrl = () =>
  String(process.env.FRONTEND_URL || "")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

const getSupportLeadUrl = (leadId) => {
  const path = `/support/leads?lead=${encodeURIComponent(leadId)}`;
  const baseUrl = getFrontendBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
};

const invalidateBookingCaches = async (userId) => {
  await Promise.allSettled([
    deletePattern(`customer:${userId}:bookings:*`),
    deletePattern(`customer:${userId}:booking:*`),
    invalidateCustomerCache(userId),
  ]);
};

const withAssignmentFlags = (lead, supportAccountId) => ({
  ...lead,
  assignedToMe: lead.claimedById === supportAccountId,
  canClaim: lead.status === "PENDING" && !lead.claimedById,
  canAct:
    lead.claimedById === supportAccountId &&
    ["CLAIMED", "IN_CALL"].includes(lead.status),
});

const getFirstBookingOffer = async (userId) => {
  const [user, bookingCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstBookingOfferConsumedAt: true },
    }),
    prisma.booking.count({ where: { userId } }),
  ]);

  return {
    available:
      Boolean(user) &&
      !user.firstBookingOfferConsumedAt &&
      bookingCount === 0,
    maxEstimatedBill: FIRST_BOOKING_MAX_ESTIMATE,
  };
};

const getLeadById = async (leadId) =>
  prisma.bookingVerificationLead.findUnique({
    where: { id: leadId },
    include: LEAD_INCLUDE,
  });

const notifyLeadCreated = async (leadId) => {
  const lead = await getLeadById(leadId);
  if (!lead) return { notified: false };

  const link = `/support/leads?lead=${lead.id}`;
  const supportUrl = getSupportLeadUrl(lead.id);
  const accounts = await prisma.customerSupportAccount.findMany({
    where: { isActive: true },
    select: { id: true, email: true },
  });

  const notificationPromise = supportNotificationService.notifyAllActive({
    title: "New first-booking verification lead",
    message: `${lead.user.name || "A customer"} is waiting for a verification call for booking ${lead.booking.bookingCode}.`,
    type: "BOOKING_VERIFICATION_LEAD",
    link,
    metadata: {
      leadId: lead.id,
      bookingId: lead.bookingId,
      bookingCode: lead.booking.bookingCode,
      customerId: lead.userId,
    },
  });

  const emailResults = await Promise.allSettled(
    accounts.map((account) =>
      emailService.sendNewLeadEmail({
        to: account.email,
        lead,
        supportUrl,
      }),
    ),
  );

  const [notificationResult] = await Promise.allSettled([notificationPromise]);
  const emailSent = emailResults.filter((result) => result.status === "fulfilled").length;
  const emailFailed = emailResults.length - emailSent;

  if (emailFailed > 0) {
    console.warn("[verification-lead] some support emails failed", {
      leadId,
      emailSent,
      emailFailed,
    });
  }

  return {
    notified: notificationResult.status === "fulfilled",
    emailSent,
    emailFailed,
  };
};

const listLeads = async (query, supportAccountId) => {
  const status = String(query.status || "").trim().toUpperCase();
  const allowedStatuses = ["PENDING", "CLAIMED", "IN_CALL", "APPROVED", "REJECTED"];
  const where = status && allowedStatuses.includes(status) ? { status } : {};
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);

  const leads = await prisma.bookingVerificationLead.findMany({
    where,
    include: LEAD_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });

  return leads.map((lead) => withAssignmentFlags(lead, supportAccountId));
};

const getSupportLead = async (leadId, supportAccountId) => {
  const lead = await getLeadById(leadId);
  if (!lead) throw new ApiError(404, "Verification lead not found");
  return withAssignmentFlags(lead, supportAccountId);
};

const claimLead = async (leadId, supportAccount) => {
  const claimedAt = new Date();
  const result = await prisma.bookingVerificationLead.updateMany({
    where: {
      id: leadId,
      status: "PENDING",
      claimedById: null,
    },
    data: {
      status: "CLAIMED",
      claimedById: supportAccount.id,
      claimedAt,
    },
  });

  if (result.count !== 1) {
    const existing = await getLeadById(leadId);
    if (!existing) throw new ApiError(404, "Verification lead not found");
    if (existing.claimedById === supportAccount.id) {
      return withAssignmentFlags(existing, supportAccount.id);
    }
    throw new ApiError(409, "Another support agent claimed this lead first");
  }

  await prisma.bookingEvent.create({
    data: {
      bookingId: (await getLeadById(leadId)).bookingId,
      actorType: "CUSTOMER_SUPPORT",
      actorId: supportAccount.id,
      actorName: supportAccount.name,
      actorRole: "CUSTOMER_SUPPORT",
      eventType: "FIRST_BOOKING_LEAD_CLAIMED",
      title: "Verification lead claimed",
      detail: `${supportAccount.name} claimed the first-booking verification lead.`,
    },
  });

  return getSupportLead(leadId, supportAccount.id);
};

const startCall = async (leadId, supportAccount) => {
  const lead = await getLeadById(leadId);
  if (!lead) throw new ApiError(404, "Verification lead not found");
  if (lead.claimedById !== supportAccount.id) {
    throw new ApiError(403, "Claim this lead before calling the customer");
  }
  if (["APPROVED", "REJECTED"].includes(lead.status)) {
    throw new ApiError(409, "This verification lead is already closed");
  }

  if (!lead.callStartedAt) {
    await prisma.$transaction([
      prisma.bookingVerificationLead.update({
        where: { id: leadId },
        data: {
          status: "IN_CALL",
          callStartedAt: new Date(),
        },
      }),
      prisma.bookingEvent.create({
        data: {
          bookingId: lead.bookingId,
          actorType: "CUSTOMER_SUPPORT",
          actorId: supportAccount.id,
          actorName: supportAccount.name,
          actorRole: "CUSTOMER_SUPPORT",
          eventType: "FIRST_BOOKING_VERIFICATION_CALL_STARTED",
          title: "Verification call started",
          detail: `${supportAccount.name} started the customer verification call.`,
        },
      }),
    ]);
  }

  return getSupportLead(leadId, supportAccount.id);
};

const getCallCompletion = (lead, endedAt) => {
  if (!lead.callStartedAt) {
    throw new ApiError(409, "Start the customer call before closing this lead");
  }

  return {
    callEndedAt: endedAt,
    callDurationSeconds: Math.max(
      0,
      Math.round((endedAt.getTime() - new Date(lead.callStartedAt).getTime()) / 1000),
    ),
  };
};

const approveLead = async (leadId, supportAccount, notes = null) => {
  const endedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.bookingVerificationLead.findUnique({
      where: { id: leadId },
      include: LEAD_INCLUDE,
    });

    if (!lead) throw new ApiError(404, "Verification lead not found");
    if (lead.status === "APPROVED") return { lead, completedNow: false };
    if (lead.claimedById !== supportAccount.id) {
      throw new ApiError(403, "Only the support agent who claimed this lead can approve it");
    }
    if (!["CLAIMED", "IN_CALL"].includes(lead.status)) {
      throw new ApiError(409, "This verification lead cannot be approved");
    }

    const call = getCallCompletion(lead, endedAt);
    const bookingUpdate = await tx.booking.updateMany({
      where: {
        id: lead.bookingId,
        status: "PENDING_VERIFICATION",
      },
      data: {
        status: "SEARCHING_GARAGE",
        searchExpiresAt: null,
        expiredAt: null,
        garageSearchRound: 0,
        garageSearchCycle: 1,
        searchRadiusKm: null,
      },
    });

    if (bookingUpdate.count !== 1) {
      throw new ApiError(409, "Booking is no longer waiting for verification");
    }

    const updatedLead = await tx.bookingVerificationLead.update({
      where: { id: leadId },
      data: {
        status: "APPROVED",
        verificationNotes: notes || null,
        approvedAt: endedAt,
        ...call,
      },
      include: LEAD_INCLUDE,
    });

    await tx.bookingEvent.create({
      data: {
        bookingId: lead.bookingId,
        actorType: "CUSTOMER_SUPPORT",
        actorId: supportAccount.id,
        actorName: supportAccount.name,
        actorRole: "CUSTOMER_SUPPORT",
        eventType: "FIRST_BOOKING_VERIFICATION_APPROVED",
        title: "First booking verified",
        detail: `Customer verification approved after a ${call.callDurationSeconds}-second call. Garage search started.`,
        metadata: {
          leadId,
          callDurationSeconds: call.callDurationSeconds,
        },
      },
    });

    return { lead: updatedLead, completedNow: true };
  });

  if (result.completedNow) {
    await invalidateBookingCaches(result.lead.userId);
    await notificationService.createNotification({
      userId: result.lead.userId,
      title: "Your first booking is verified",
      message: `Verification is complete for booking ${result.lead.booking.bookingCode}. We are now searching for a suitable garage.`,
      type: "BOOKING",
      link: "/tracking",
      metadata: {
        bookingId: result.lead.bookingId,
        leadId: result.lead.id,
      },
    }).catch((error) => {
      console.warn("[verification-lead] customer approval notification failed", error.message);
    });

    await garageRequestService
      .broadcastBookingToNearbyGarages(result.lead.bookingId)
      .catch((error) => {
        console.error("[verification-lead] garage search failed to start", {
          leadId,
          bookingId: result.lead.bookingId,
          message: error.message,
        });
      });
  }

  return getSupportLead(leadId, supportAccount.id);
};

const rejectLead = async (leadId, supportAccount, notes = null) => {
  const endedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.bookingVerificationLead.findUnique({
      where: { id: leadId },
      include: LEAD_INCLUDE,
    });

    if (!lead) throw new ApiError(404, "Verification lead not found");
    if (lead.status === "REJECTED") return { lead, completedNow: false };
    if (lead.claimedById !== supportAccount.id) {
      throw new ApiError(403, "Only the support agent who claimed this lead can reject it");
    }
    if (!["CLAIMED", "IN_CALL"].includes(lead.status)) {
      throw new ApiError(409, "This verification lead cannot be rejected");
    }

    const call = getCallCompletion(lead, endedAt);
    const bookingUpdate = await tx.booking.updateMany({
      where: {
        id: lead.bookingId,
        status: "PENDING_VERIFICATION",
      },
      data: {
        status: "CANCELLED",
        expiredAt: endedAt,
      },
    });

    if (bookingUpdate.count !== 1) {
      throw new ApiError(409, "Booking is no longer waiting for verification");
    }

    const updatedLead = await tx.bookingVerificationLead.update({
      where: { id: leadId },
      data: {
        status: "REJECTED",
        verificationNotes: notes || null,
        rejectionReason: "Marked suspicious by customer support",
        rejectedAt: endedAt,
        ...call,
      },
      include: LEAD_INCLUDE,
    });

    await tx.bookingEvent.create({
      data: {
        bookingId: lead.bookingId,
        actorType: "CUSTOMER_SUPPORT",
        actorId: supportAccount.id,
        actorName: supportAccount.name,
        actorRole: "CUSTOMER_SUPPORT",
        eventType: "FIRST_BOOKING_VERIFICATION_REJECTED",
        title: "First booking rejected as suspicious",
        detail: `Customer verification was rejected after a ${call.callDurationSeconds}-second call.`,
        metadata: {
          leadId,
          callDurationSeconds: call.callDurationSeconds,
          notes: notes || null,
        },
      },
    });

    return { lead: updatedLead, completedNow: true };
  });

  if (result.completedNow) {
    await invalidateBookingCaches(result.lead.userId);
    await Promise.allSettled([
      notificationService.createNotification({
        userId: result.lead.userId,
        title: "Booking verification could not be completed",
        message: `Booking ${result.lead.booking.bookingCode} was not approved. Contact Rovauto support if you believe this is a mistake.`,
        type: "BOOKING",
        link: "/dashboard/support",
        metadata: {
          bookingId: result.lead.bookingId,
          leadId: result.lead.id,
        },
      }),
      emailService.sendSuspiciousLeadEmail({
        lead: result.lead,
        supportAgent: supportAccount,
      }),
    ]);
  }

  return getSupportLead(leadId, supportAccount.id);
};

const getCustomerVerification = async (userId, bookingId) => {
  const lead = await prisma.bookingVerificationLead.findFirst({
    where: {
      bookingId,
      userId,
    },
    include: CUSTOMER_LEAD_INCLUDE,
  });

  if (!lead) throw new ApiError(404, "Booking verification record not found");

  return {
    lead,
    waiting: ["PENDING", "CLAIMED", "IN_CALL"].includes(lead.status),
    approved: lead.status === "APPROVED",
    rejected: lead.status === "REJECTED",
    trackingReady:
      lead.status === "APPROVED" && lead.booking.status === "SEARCHING_GARAGE",
  };
};

const escalateUnclaimedLeads = async () => {
  const cutoff = new Date(Date.now() - LEAD_ESCALATION_MINUTES * 60 * 1000);
  const candidates = await prisma.bookingVerificationLead.findMany({
    where: {
      status: "PENDING",
      claimedById: null,
      escalatedAt: null,
      escalationAttemptedAt: null,
      createdAt: { lte: cutoff },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  let sent = 0;
  for (const candidate of candidates) {
    const attemptedAt = new Date();
    const claim = await prisma.bookingVerificationLead.updateMany({
      where: {
        id: candidate.id,
        status: "PENDING",
        claimedById: null,
        escalatedAt: null,
        escalationAttemptedAt: null,
      },
      data: { escalationAttemptedAt: attemptedAt },
    });

    if (claim.count !== 1) continue;

    try {
      const lead = await getLeadById(candidate.id);
      if (!lead) continue;
      await emailService.sendUnclaimedEscalationEmail({
        lead,
        supportUrl: getSupportLeadUrl(lead.id),
      });
      await prisma.bookingVerificationLead.update({
        where: { id: lead.id },
        data: { escalatedAt: new Date() },
      });
      sent += 1;
    } catch (error) {
      await prisma.bookingVerificationLead.updateMany({
        where: {
          id: candidate.id,
          escalatedAt: null,
          escalationAttemptedAt: attemptedAt,
        },
        data: { escalationAttemptedAt: null },
      });
      console.error("[verification-lead] escalation email failed", {
        leadId: candidate.id,
        message: error.message,
      });
    }
  }

  return { checked: candidates.length, sent };
};

module.exports = {
  FIRST_BOOKING_MAX_ESTIMATE,
  LEAD_ESCALATION_MINUTES,
  approveLead,
  claimLead,
  escalateUnclaimedLeads,
  getCustomerVerification,
  getFirstBookingOffer,
  getSupportLead,
  listLeads,
  notifyLeadCreated,
  rejectLead,
  startCall,
};
