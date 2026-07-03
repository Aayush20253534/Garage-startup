require("dotenv/config");

const prisma = require("../config/prisma");
const {
  buildDeletionSummary,
  deleteGaragesDeep,
  findGaragesForDeletion,
} = require("../admin/services/garageDeletion.service");

const args = process.argv.slice(2);

const VALID_SCOPES = new Set(["garages", "price-ranges", "bookings", "notifications"]);

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

Dry-run is the default. Add --confirm to delete.

Examples:
  npm run db:delete-garages --
  npm run db:delete-garages -- --confirm
  npm run db:delete-garages -- --email=owner@example.com --confirm
  npm run db:delete-price-ranges -- --confirm
  npm run db:delete-bookings -- --confirm
  npm run db:delete-notifications -- --confirm
`);
};

const getScope = () => {
  const scope = getArg("scope");
  return VALID_SCOPES.has(scope) ? scope : "";
};

const printDryRun = () => {
  console.log("\nDry-run only. Re-run with --confirm to delete these records.");
};

const deleteGarages = async () => {
  const email = getArg("email");
  const garages = await findGaragesForDeletion({ email });
  const garageIds = garages.map((garage) => garage.id);
  const deleteAllApplications = !normalizeEmail(email);
  const related = await buildDeletionSummary(garages, { deleteAllApplications });

  console.log(`Matched ${garages.length} garage(s).`);
  console.log({ related });
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
      }))
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

  const result = await deleteGaragesDeep({ garageIds, deleteAllApplications });
  console.log(`Deleted ${result.deletedGarages} garage(s), ${result.deletedApplications} application(s), ${result.deletedBookings} booking(s), and ${result.deletedOwnerUsers} owner user(s).`);
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
    select: { id: true, bookingCode: true, status: true, userId: true, garageId: true },
    orderBy: { createdAt: "desc" },
  });
  const bookingIds = bookings.map((booking) => booking.id);

  const related =
    bookingIds.length === 0
      ? { payments: 0, services: 0, broadcasts: 0, images: 0, reviews: 0, complaintsDetached: 0 }
      : {
          payments: await prisma.payment.count({ where: { bookingId: { in: bookingIds } } }),
          services: await prisma.bookingService.count({ where: { bookingId: { in: bookingIds } } }),
          broadcasts: await prisma.garageBroadcastRequest.count({ where: { bookingId: { in: bookingIds } } }),
          images: await prisma.bookingInspectionImage.count({ where: { bookingId: { in: bookingIds } } }),
          reviews: await prisma.review.count({ where: { bookingId: { in: bookingIds } } }),
          complaintsDetached: await prisma.complaint.count({ where: { bookingId: { in: bookingIds } } }),
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
      }))
    );
    if (bookings.length > 25) console.log(`Showing first 25 of ${bookings.length} bookings.`);
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
      where: { bookingId: { in: bookingIds } },
      data: { bookingId: null },
    });

    await tx.booking.deleteMany({
      where: { id: { in: bookingIds } },
    });
  });

  console.log(`Deleted ${bookingIds.length} booking(s).`);
};

const deleteNotifications = async () => {
  const count = await prisma.notification.count();
  console.log(`Matched ${count} notification(s).`);

  if (!hasFlag("confirm")) {
    printDryRun();
    return;
  }

  const result = await prisma.notification.deleteMany();
  console.log(`Deleted ${result.count} notification(s).`);
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
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
