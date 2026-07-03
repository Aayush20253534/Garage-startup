const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deleteFromCloudinary } = require("../../utils/cloudinaryUpload");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizePhone = (phone) => String(phone || "").trim();
const unique = (values) => [...new Set(values.filter(Boolean))];

const buildApplicationWhere = (garages, deleteAllApplications = false) => {
  if (deleteAllApplications) return {};

  const garageIds = garages.map((garage) => garage.id);
  const applicationIds = unique(garages.map((garage) => garage.applicationId));
  const emails = unique(garages.flatMap((garage) => [garage.email, garage.owner?.email].map(normalizeEmail)));
  const phones = unique(garages.flatMap((garage) => [garage.phone, garage.owner?.phone].map(normalizePhone)));

  const OR = [
    garageIds.length ? { approvedGarageId: { in: garageIds } } : null,
    applicationIds.length ? { id: { in: applicationIds } } : null,
    emails.length ? { email: { in: emails } } : null,
    phones.length ? { phone: { in: phones } } : null,
  ].filter(Boolean);

  return OR.length ? { OR } : { id: { in: [] } };
};

const findGaragesForDeletion = async ({ garageIds = [], email = "" } = {}) => {
  const ids = unique(Array.isArray(garageIds) ? garageIds : []);
  const normalizedEmail = normalizeEmail(email);

  const where = ids.length
    ? { id: { in: ids } }
    : normalizedEmail
      ? {
          OR: [
            { email: normalizedEmail },
            { owner: { is: { email: normalizedEmail } } },
          ],
        }
      : {};

  return prisma.garage.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      applicationId: true,
      ownerId: true,
      owner: { select: { id: true, name: true, email: true, phone: true, role: true } },
      _count: {
        select: {
          bookings: true,
          broadcasts: true,
          images: true,
          services: true,
          videos: true,
          walletTransactions: true,
          reviews: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

const buildDeletionSummary = async (garages, { deleteAllApplications = false } = {}) => {
  const garageIds = garages.map((garage) => garage.id);
  const bookingIds = garageIds.length
    ? (await prisma.booking.findMany({
        where: { garageId: { in: garageIds } },
        select: { id: true },
      })).map((booking) => booking.id)
    : [];

  const applicationWhere = buildApplicationWhere(garages, deleteAllApplications);
  const ownerIds = unique(garages.map((garage) => garage.ownerId));

  return {
    garages: garages.length,
    bookings: bookingIds.length,
    complaintsDetached: bookingIds.length
      ? await prisma.complaint.count({ where: { bookingId: { in: bookingIds } } })
      : 0,
    applications: await prisma.garageApplication.count({ where: applicationWhere }),
    ownerUsersChecked: ownerIds.length,
  };
};

const deleteGaragesDeep = async ({ garageIds = [], email = "", deleteAllApplications = false } = {}) => {
  const garages = await findGaragesForDeletion({ garageIds, email });
  const ids = garages.map((garage) => garage.id);

  if (!ids.length && !deleteAllApplications) {
    if (garageIds.length || email) throw new ApiError(404, "No garages found to delete");
    return { deletedGarages: 0, deletedApplications: 0, deletedBookings: 0, deletedOwnerUsers: 0 };
  }

  const applicationWhere = buildApplicationWhere(garages, deleteAllApplications);
  const ownerIds = unique(garages.map((garage) => garage.ownerId));

  const media = await Promise.all([
    prisma.garageImage.findMany({ where: { garageId: { in: ids } }, select: { publicId: true } }),
    prisma.garageVideo.findMany({ where: { garageId: { in: ids } }, select: { publicId: true } }),
    prisma.bookingInspectionImage.findMany({ where: { garageId: { in: ids } }, select: { publicId: true } }),
    prisma.garageApplicationImage.findMany({ where: { application: { is: applicationWhere } }, select: { publicId: true } }),
  ]);
  const publicIds = unique(media.flat().map((item) => item.publicId));

  const result = await prisma.$transaction(async (tx) => {
    const bookings = await tx.booking.findMany({
      where: { garageId: { in: ids } },
      select: { id: true },
    });
    const bookingIds = bookings.map((booking) => booking.id);

    if (bookingIds.length) {
      await tx.complaint.updateMany({
        where: { bookingId: { in: bookingIds } },
        data: { bookingId: null },
      });
      await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }

    const deletedApplications = await tx.garageApplication.deleteMany({ where: applicationWhere });
    const deletedGarages = await tx.garage.deleteMany({ where: { id: { in: ids } } });

    const orphanOwners = ownerIds.length
      ? await tx.user.findMany({
          where: {
            id: { in: ownerIds },
            role: "GARAGE_OWNER",
            ownedGarages: { none: {} },
          },
          select: { id: true },
        })
      : [];
    const deletedOwnerUsers = orphanOwners.length
      ? await tx.user.deleteMany({ where: { id: { in: orphanOwners.map((owner) => owner.id) } } })
      : { count: 0 };

    return {
      deletedGarages: deletedGarages.count,
      deletedApplications: deletedApplications.count,
      deletedBookings: bookingIds.length,
      deletedOwnerUsers: deletedOwnerUsers.count,
    };
  });

  await Promise.all(publicIds.map((publicId) => deleteFromCloudinary(publicId).catch(() => null)));

  return result;
};

module.exports = {
  buildDeletionSummary,
  deleteGaragesDeep,
  findGaragesForDeletion,
};
