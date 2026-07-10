require("dotenv/config");

const prisma = require("../config/prisma");

const args = process.argv.slice(2);

const ACTIVE_BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
];

const SERVICE_HISTORY_STATUSES = ["COMPLETED"];

const VALID_SCOPES = new Set([
  "active-bookings",
  "payments",
  "service-history",
]);

const getArg = (name) => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : "";
};

const hasFlag = (name) => args.includes(`--${name}`);

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const usage = () => {
  console.log(`
Usage:
  npm run db:delete-active-bookings -- --email=user@example.com
  npm run db:delete-payments -- --email=user@example.com
  npm run db:delete-service-history -- --email=user@example.com

Dry-run is the default. Add --confirm to delete.

Examples:
  npm run db:delete-active-bookings -- --email=aayush@example.com
  npm run db:delete-active-bookings -- --email=aayush@example.com --confirm
  npm run db:delete-payments -- --email=aayush@example.com --confirm
  npm run db:delete-service-history -- --email=aayush@example.com --confirm
`);
};

const getBookingWhere = (userId, scope) => {
  if (scope === "active-bookings") {
    return {
      userId,
      status: {
        in: ACTIVE_BOOKING_STATUSES,
      },
    };
  }

  if (scope === "service-history") {
    return {
      userId,
      status: {
        in: SERVICE_HISTORY_STATUSES,
      },
    };
  }

  return { userId };
};

const summarizeBookings = async (user, scope) => {
  const bookingWhere = getBookingWhere(user.id, scope);

  const bookings = await prisma.booking.findMany({
    where: bookingWhere,
    select: {
      id: true,
      bookingCode: true,
      status: true,
      payableAmount: true,
      totalServiceAmount: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const bookingIds = bookings.map((booking) => booking.id);

  const [
    payments,
    complaints,
    bookingServices,
    broadcasts,
    reviews,
    inspectionImages,
    trackingPoints,
    adminEvents,
    supportTicketsDetached,
  ] =
    bookingIds.length === 0
      ? [0, 0, 0, 0, 0, 0, 0, 0, 0]
      : await Promise.all([
          prisma.payment.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          prisma.complaint.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          prisma.bookingService.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          prisma.garageBroadcastRequest.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          prisma.review.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          prisma.bookingInspectionImage.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          prisma.bookingTrackingPoint.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          prisma.adminBookingEvent.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          prisma.supportTicket.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
        ]);

  return {
    bookings,
    counts: {
      bookings: bookings.length,
      payments,
      complaintsDetached: complaints,
      bookingServices,
      broadcasts,
      reviews,
      inspectionImages,
      trackingPoints,
      adminEvents,
      supportTicketsDetached,
    },
  };
};

const summarizePayments = async (user) => {
  const bookings = await prisma.booking.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      bookingCode: true,
      status: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const bookingIds = bookings.map((booking) => booking.id);

  const payments =
    bookingIds.length === 0
      ? []
      : await prisma.payment.findMany({
          where: {
            bookingId: {
              in: bookingIds,
            },
          },
          select: {
            id: true,
            bookingId: true,
            amount: true,
            status: true,
            cashfreeOrderId: true,
            cashfreePaymentId: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

  return {
    bookingIds,
    payments,
    counts: {
      bookingsChecked: bookings.length,
      payments: payments.length,
    },
  };
};

const printUser = (user) => {
  console.log({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  });
};

const deleteBookingsForScope = async (user, scope) => {
  const { bookings, counts } = await summarizeBookings(user, scope);
  console.log({ scope, related: counts });

  if (bookings.length > 0) {
    console.table(
      bookings.map((booking) => ({
        code: booking.bookingCode,
        status: booking.status,
        payableAmount: booking.payableAmount,
        totalServiceAmount: booking.totalServiceAmount,
      })),
    );
  }

  if (!hasFlag("confirm")) {
    console.log("\nDry-run only. Re-run with --confirm to delete these records.");
    return;
  }

  if (bookings.length === 0) {
    console.log("No matching bookings to delete.");
    return;
  }

  const bookingIds = bookings.map((booking) => booking.id);

  await prisma.$transaction(async (tx) => {
    await tx.complaint.updateMany({
      where: {
        bookingId: {
          in: bookingIds,
        },
      },
      data: {
        bookingId: null,
      },
    });

    await tx.booking.deleteMany({
      where: {
        id: {
          in: bookingIds,
        },
      },
    });
  });

  console.log(`Deleted ${bookings.length} ${scope} booking(s).`);
};

const deletePayments = async (user) => {
  const { bookingIds, payments, counts } = await summarizePayments(user);
  console.log({ scope: "payments", related: counts });

  if (payments.length > 0) {
    const paymentBookingById = new Map(
      (
        await prisma.booking.findMany({
          where: {
            id: {
              in: bookingIds,
            },
          },
          select: {
            id: true,
            bookingCode: true,
            status: true,
          },
        })
      ).map((booking) => [booking.id, booking]),
    );

    console.table(
      payments.map((payment) => {
        const booking = paymentBookingById.get(payment.bookingId);

        return {
          bookingCode: booking?.bookingCode,
          bookingStatus: booking?.status,
          amount: payment.amount,
          paymentStatus: payment.status,
          cashfreeOrderId: payment.cashfreeOrderId,
        };
      }),
    );
  }

  if (!hasFlag("confirm")) {
    console.log("\nDry-run only. Re-run with --confirm to delete these records.");
    return;
  }

  if (payments.length === 0) {
    console.log("No matching payments to delete.");
    return;
  }

  await prisma.payment.deleteMany({
    where: {
      id: {
        in: payments.map((payment) => payment.id),
      },
    },
  });

  console.log(`Deleted ${payments.length} payment record(s).`);
};

const deleteCustomerRecords = async () => {
  const scope = getArg("scope");
  const email = normalizeEmail(getArg("email"));

  if (!VALID_SCOPES.has(scope) || !email || hasFlag("help")) {
    usage();
    return;
  }

  /*
   * User.email is unique with role, not globally. These commands are customer
   * cleanup commands, so selecting CUSTOMER prevents an account with the same
   * email under GARAGE_OWNER from being touched.
   */
  const user = await prisma.user.findFirst({
    where: {
      email,
      role: "CUSTOMER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  if (!user) {
    console.log(`No customer found for email: ${email}`);
    return;
  }

  printUser(user);

  if (scope === "payments") {
    await deletePayments(user);
    return;
  }

  await deleteBookingsForScope(user, scope);
};

deleteCustomerRecords()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
