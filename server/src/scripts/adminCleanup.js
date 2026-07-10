require("dotenv/config");

const prisma = require("../config/prisma");
const { deleteFromCloudinary } = require("../utils/cloudinaryUpload");
const {
  buildDeletionSummary,
  deleteGaragesDeep,
  findGaragesForDeletion,
} = require("../admin/services/garageDeletion.service");

const args = process.argv.slice(2);

const VALID_SCOPES = new Set([
  "garages",
  "price-ranges",
  "bookings",
  "notifications",
  "support-data",
  "auth-sessions",
  "system-issues",
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
  npm run db:delete-garages -- [--email=garage@example.com] [--confirm]
  npm run db:delete-price-ranges -- [--confirm]
  npm run db:delete-bookings -- [--confirm]
  npm run db:delete-notifications -- [--confirm]
  npm run db:delete-support-data -- [--confirm]
  npm run db:delete-auth-sessions -- [--confirm]
  npm run db:delete-system-issues -- [--confirm]

Dry-run is the default. Add --confirm to delete.

Examples:
  npm run db:delete-garages --
  npm run db:delete-garages -- --confirm
  npm run db:delete-garages -- --email=owner@example.com --confirm
  npm run db:delete-price-ranges -- --confirm
  npm run db:delete-bookings -- --confirm
  npm run db:delete-notifications -- --confirm
  npm run db:delete-support-data -- --confirm
  npm run db:delete-auth-sessions -- --confirm
  npm run db:delete-system-issues -- --confirm
`);
};

const getScope = () => {
  const scope = getArg("scope");
  return VALID_SCOPES.has(scope) ? scope : "";
};

const printDryRun = () => {
  console.log("\nDry-run only. Re-run with --confirm to delete these records.");
};

const deleteCloudinaryImages = async (publicIds = []) => {
  const uniquePublicIds = [...new Set(publicIds.filter(Boolean))];
  const results = await Promise.allSettled(
    uniquePublicIds.map((publicId) => deleteFromCloudinary(publicId, "image")),
  );

  return {
    requested: uniquePublicIds.length,
    deleted: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
};

const countSystemIssueReferences = async ({ garageIds, ownerIds }) => {
  const [byGarage, byOwner] = await Promise.all([
    garageIds.length
      ? prisma.systemIssue.count({
          where: {
            garageId: {
              in: garageIds,
            },
          },
        })
      : 0,
    ownerIds.length
      ? prisma.systemIssue.count({
          where: {
            userId: {
              in: ownerIds,
            },
          },
        })
      : 0,
  ]);

  return {
    systemIssuesLinkedToGarages: byGarage,
    systemIssuesLinkedToOwners: byOwner,
  };
};

const detachSystemIssueReferences = async ({ garageIds, ownerIds }) => {
  if (garageIds.length) {
    await prisma.systemIssue.updateMany({
      where: {
        garageId: {
          in: garageIds,
        },
      },
      data: {
        garageId: null,
      },
    });
  }

  if (ownerIds.length) {
    await prisma.systemIssue.updateMany({
      where: {
        userId: {
          in: ownerIds,
        },
      },
      data: {
        userId: null,
      },
    });
  }
};

const deleteGarages = async () => {
  const email = getArg("email");
  const garages = await findGaragesForDeletion({ email });
  const garageIds = garages.map((garage) => garage.id);
  const ownerIds = [
    ...new Set(garages.map((garage) => garage.ownerId).filter(Boolean)),
  ];
  const deleteAllApplications = !normalizeEmail(email);

  const [related, issueReferences] = await Promise.all([
    buildDeletionSummary(garages, {
      deleteAllApplications,
    }),
    countSystemIssueReferences({
      garageIds,
      ownerIds,
    }),
  ]);

  console.log(`Matched ${garages.length} garage(s).`);
  console.log({
    related: {
      ...related,
      ...issueReferences,
    },
  });

  if (garages.length) {
    console.table(
      garages.map((garage) => ({
        id: garage.id,
        name: garage.name,
        garageEmail: garage.email,
        ownerEmail: garage.owner?.email,
        city: garage.city,
        bookingsDeleted: garage._count.bookings,
        services: garage._count.services,
        broadcasts: garage._count.broadcasts,
      })),
    );
  }

  if (!hasFlag("confirm")) {
    printDryRun();
    return;
  }

  if (!garageIds.length && !deleteAllApplications) {
    console.log("No garages to delete.");
    return;
  }

  await detachSystemIssueReferences({
    garageIds,
    ownerIds,
  });

  const result = await deleteGaragesDeep({
    garageIds,
    deleteAllApplications,
  });

  console.log(
    `Deleted ${result.deletedGarages} garage(s), ${result.deletedApplications} application(s), ${result.deletedBookings} booking(s), and ${result.deletedOwnerUsers} owner user(s).`,
  );
};

const deletePriceRanges = async () => {
  const count = await prisma.cityServicePriceRange.count();
  console.log(`Matched ${count} city service price range record(s).`);

  if (!hasFlag("confirm")) {
    printDryRun();
    return;
  }

  const result = await prisma.cityServicePriceRange.deleteMany();
  console.log(`Deleted ${result.count} price range record(s).`);
};

const deleteBookings = async () => {
  const bookings = await prisma.booking.findMany({
    select: {
      id: true,
      bookingCode: true,
      status: true,
      userId: true,
      garageId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const bookingIds = bookings.map((booking) => booking.id);

  const related =
    bookingIds.length === 0
      ? {
          payments: 0,
          services: 0,
          broadcasts: 0,
          images: 0,
          reviews: 0,
          trackingPoints: 0,
          adminEvents: 0,
          supportTicketsDetached: 0,
          complaintsDetached: 0,
        }
      : {
          payments: await prisma.payment.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          services: await prisma.bookingService.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          broadcasts: await prisma.garageBroadcastRequest.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          images: await prisma.bookingInspectionImage.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          reviews: await prisma.review.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          trackingPoints: await prisma.bookingTrackingPoint.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          adminEvents: await prisma.adminBookingEvent.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          supportTicketsDetached: await prisma.supportTicket.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
          complaintsDetached: await prisma.complaint.count({
            where: {
              bookingId: {
                in: bookingIds,
              },
            },
          }),
        };

  console.log(`Matched ${bookings.length} booking(s).`);
  console.log({ related });

  if (bookings.length) {
    console.table(
      bookings.slice(0, 25).map((booking) => ({
        code: booking.bookingCode,
        status: booking.status,
        userId: booking.userId,
        garageId: booking.garageId,
      })),
    );

    if (bookings.length > 25) {
      console.log(`Showing first 25 of ${bookings.length} bookings.`);
    }
  }

  if (!hasFlag("confirm")) {
    printDryRun();
    return;
  }

  if (!bookingIds.length) {
    console.log("No bookings to delete.");
    return;
  }

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

  console.log(`Deleted ${bookingIds.length} booking(s).`);
};

const deleteNotifications = async () => {
  const [customerNotifications, supportNotifies] = await Promise.all([
    prisma.notification.count(),
    prisma.notify.count(),
  ]);

  console.log("Matched notification records:");
  console.log({
    customerNotifications,
    supportNotifies,
  });

  if (!hasFlag("confirm")) {
    printDryRun();
    return;
  }

  const [customerResult, supportResult] = await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.notify.deleteMany(),
  ]);

  console.log(
    `Deleted ${customerResult.count} customer notification(s) and ${supportResult.count} support notify row(s).`,
  );
};

const deleteSupportData = async () => {
  const attachments = await prisma.supportTicketAttachment.findMany({
    select: { publicId: true },
  });
  const related = {
    supportTickets: await prisma.supportTicket.count(),
    supportTicketMessages: await prisma.supportTicketMessage.count(),
    supportTicketAttachments: await prisma.supportTicketAttachment.count(),
    supportNotifies: await prisma.notify.count(),
    supportPushSubscriptions:
      await prisma.customerSupportPushSubscription.count(),
    supportEmailLogs: await prisma.customerSupportEmailLog.count(),
  };

  console.log("Matched support desk data:");
  console.log({ related });

  if (!hasFlag("confirm")) {
    printDryRun();
    return;
  }

  const [tickets, notifies, pushSubscriptions, emailLogs] =
    await prisma.$transaction([
      prisma.supportTicket.deleteMany(),
      prisma.notify.deleteMany(),
      prisma.customerSupportPushSubscription.deleteMany(),
      prisma.customerSupportEmailLog.deleteMany(),
    ]);

  const media = await deleteCloudinaryImages(
    attachments.map((attachment) => attachment.publicId),
  );

  console.log(
    `Deleted ${tickets.count} ticket(s), ${notifies.count} support notify row(s), ${pushSubscriptions.count} support push subscription(s), ${emailLogs.count} support email log(s), and ${media.deleted}/${media.requested} support attachment image(s) from Cloudinary.`,
  );

  if (media.failed) {
    console.warn(
      `${media.failed} support attachment image deletion(s) failed in Cloudinary.`,
    );
  }
};

const deleteAuthSessions = async () => {
  const related = {
    userSessions: await prisma.userSession.count(),
    customerPushSubscriptions: await prisma.pushSubscription.count(),
    supportPushSubscriptions:
      await prisma.customerSupportPushSubscription.count(),
  };

  console.log("Matched auth session and push endpoint data:");
  console.log({ related });

  if (!hasFlag("confirm")) {
    printDryRun();
    return;
  }

  const [sessions, customerPush, supportPush] = await prisma.$transaction([
    prisma.userSession.deleteMany(),
    prisma.pushSubscription.deleteMany(),
    prisma.customerSupportPushSubscription.deleteMany(),
  ]);

  console.log(
    `Deleted ${sessions.count} user session(s), ${customerPush.count} customer push subscription(s), and ${supportPush.count} support push subscription(s).`,
  );
};

const deleteSystemIssues = async () => {
  const count = await prisma.systemIssue.count();
  console.log(`Matched ${count} system issue(s).`);

  if (!hasFlag("confirm")) {
    printDryRun();
    return;
  }

  const result = await prisma.systemIssue.deleteMany();
  console.log(`Deleted ${result.count} system issue(s).`);
};

const run = async () => {
  const scope = getScope();

  if (!scope || hasFlag("help")) {
    usage();
    return;
  }

  if (scope === "garages") await deleteGarages();
  if (scope === "price-ranges") await deletePriceRanges();
  if (scope === "bookings") await deleteBookings();
  if (scope === "notifications") await deleteNotifications();
  if (scope === "support-data") await deleteSupportData();
  if (scope === "auth-sessions") await deleteAuthSessions();
  if (scope === "system-issues") await deleteSystemIssues();
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
