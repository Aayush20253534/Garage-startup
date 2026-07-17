const argon2 = require("argon2");
const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { normalizeEmail } = require("../../utils/email");
const { normalizePhone } = require("../../utils/phone");
const { uploadToCloudinary } = require("../../utils/cloudinaryUpload");
const {
  dispatchOutboxEmail,
  enqueueGarageApplicationEmail,
} = require("./applicationEmailOutbox.service");
const { deleteCloudinaryImagesIfUnreferenced } = require("../../utils/cloudinaryCleanup");
const geocodingService = require("../../customer/services/geocoding.service");
const { GARAGE_MINIMUM_ACTIVATION_RECHARGE } = require("../constants");

const getDefaultGaragePassword = (phone) => {
  const digits = normalizePhone(phone).replace(/\D/g, "");
  return digits.slice(-10);
};
const getGarageIdentityConditions = ({ email, phone }) =>
  [phone ? { phone } : null, email ? { email } : null].filter(Boolean);

const ensureGarageApplicationIdentityAvailable = async ({ email, phone }) => {
  const identityConditions = getGarageIdentityConditions({ email, phone });
  const [garageOwner, garage, application] = await Promise.all([
    prisma.garageOwner.findFirst({ where: { OR: identityConditions }, select: { id: true } }),
    prisma.garage.findFirst({ where: { OR: identityConditions }, select: { id: true } }),
    prisma.garageApplication.findFirst({
      where: {
        status: { in: ["PENDING", "CHANGES_REQUESTED", "APPROVED"] },
        OR: identityConditions,
      },
      select: { id: true, status: true },
    }),
  ]);

  // These checks intentionally use only garage-domain tables. A customer or
  // staff account may share the same contact details without blocking a
  // garage application or garage-owner login.
  if (garageOwner || garage) {
    throw new ApiError(409, "This phone or email is already linked to a garage account");
  }

  if (application) {
    throw new ApiError(409, "A garage application already exists for this phone or email");
  }
};

const enqueueOptionalApplicationEmail = async (options) => {
  if (!String(options.to || "").trim()) return null;
  return enqueueGarageApplicationEmail(options);
};
const normalizeGarageType = (value) =>
  String(value || "MULTI_BRAND").trim().toUpperCase() === "AUTHORIZED"
    ? "AUTHORIZED"
    : "MULTI_BRAND";

const parseSupportedBrands = (value) => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch {
    // Plain comma-separated form is accepted below.
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const applicationSelect = {
  id: true,
  ownerName: true,
  email: true,
  phone: true,
  garageName: true,
  description: true,
  address: true,
  city: true,
  area: true,
  latitude: true,
  longitude: true,
  placeId: true,
  workingRadiusKm: true,
  status: true,
  adminNote: true,
  reviewedAt: true,
  approvedGarageId: true,
  createdAt: true,
  updatedAt: true,
  images: {
    orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
  },
};

const submitApplication = async (payload, files = []) => {
  const email = normalizeEmail(payload.email) || null;
  const phone = normalizePhone(payload.phone);
  let latitude = payload.latitude === undefined ? null : Number(payload.latitude);
  let longitude = payload.longitude === undefined ? null : Number(payload.longitude);

  if (files.length < 10) {
    throw new ApiError(400, "Upload at least 10 garage photos");
  }

  if (files.length > 15) {
    throw new ApiError(400, "You can upload up to 15 garage photos");
  }

  await ensureGarageApplicationIdentityAvailable({ email, phone });

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const geocodeResult = await geocodingService.geocodeAddress({
      address: payload.address,
      city: payload.city,
      state: payload.area,
    });

    latitude = Number(geocodeResult.latitude);
    longitude = Number(geocodeResult.longitude);
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ApiError(400, "Could not determine coordinates for this garage address");
  }

  const uploadedImages = [];
  try {
    for (const [index, file] of files.entries()) {
      const uploaded = await uploadToCloudinary(file.buffer, "rovauto/garage-applications", "image");
      uploadedImages.push({
        imageUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        order: index,
        isThumbnail: index === 0,
      });
    }

    return await prisma.garageApplication.create({
      data: {
        ownerName: payload.ownerName.trim(),
        email,
        phone,
        garageName: payload.garageName.trim(),
        description: payload.description?.trim() || null,
        address: payload.address.trim(),
        city: payload.city.trim(),
        area: payload.area.trim(),
        latitude,
        longitude,
        placeId: payload.placeId?.trim() || null,
        workingRadiusKm: Number(payload.workingRadiusKm) || 15,
        status: "PENDING",
        images: uploadedImages.length ? { create: uploadedImages } : undefined,
      },
      select: applicationSelect,
    });
  } catch (error) {
    await Promise.all(uploadedImages.map((image) => deleteFromCloudinary(image.publicId).catch(() => null)));
    throw error;
  }
};

const listApplications = async (query = {}) => {
  const { status = "PENDING" } = query;
  return prisma.garageApplication.findMany({
    where: status ? { status } : {},
    select: applicationSelect,
    orderBy: { createdAt: "desc" },
  });
};

const getApplication = async (applicationId) => {
  const application = await prisma.garageApplication.findUnique({
    where: { id: applicationId },
    select: applicationSelect,
  });
  if (!application) throw new ApiError(404, "Garage application not found");
  return application;
};

const deliverQueuedEmail = async (outboxId) => {
  if (!outboxId) {
    return {
      status: "SKIPPED",
      reason: "NO_EMAIL_ADDRESS",
    };
  }

  try {
    return await dispatchOutboxEmail(outboxId);
  } catch (error) {
    console.error("[garage-application-email] Immediate delivery failed:", error.message);
    return {
      id: outboxId,
      status: "QUEUED",
      lastError: String(error.message || error).slice(0, 1000),
    };
  }
};

const requestChanges = async (applicationId, adminNote) => {
  const application = await getApplication(applicationId);
  const reviewedAt = new Date();
  const message = adminNote || "Please update and resubmit your garage application.";

  const result = await prisma.$transaction(async (tx) => {
    const updatedApplication = await tx.garageApplication.update({
      where: { id: applicationId },
      data: {
        status: "CHANGES_REQUESTED",
        adminNote: message,
        reviewedAt,
      },
      select: applicationSelect,
    });

    const email = await enqueueOptionalApplicationEmail({
      client: tx,
      applicationId,
      dedupeKey: `garage-application:${applicationId}:changes:${reviewedAt.getTime()}`,
      to: application.email,
      subject: "Rovauto garage application changes requested",
      message,
    });

    return { application: updatedApplication, emailOutboxId: email?.id || null };
  });

  return {
    ...result.application,
    emailDelivery: await deliverQueuedEmail(result.emailOutboxId),
  };
};

const denyApplication = async (applicationId, adminNote) => {
  const application = await getApplication(applicationId);
  const reviewedAt = new Date();
  const message = adminNote || "Your garage application was not approved at this time.";

  const result = await prisma.$transaction(async (tx) => {
    const updatedApplication = await tx.garageApplication.update({
      where: { id: applicationId },
      data: {
        status: "DENIED",
        adminNote: message,
        reviewedAt,
      },
      select: applicationSelect,
    });

    const email = await enqueueOptionalApplicationEmail({
      client: tx,
      applicationId,
      dedupeKey: `garage-application:${applicationId}:denied:${reviewedAt.getTime()}`,
      to: application.email,
      subject: "Rovauto garage application update",
      message,
    });

    return { application: updatedApplication, emailOutboxId: email?.id || null };
  });

  return {
    ...result.application,
    emailDelivery: await deliverQueuedEmail(result.emailOutboxId),
  };
};

const buildApprovalMessage = (application, defaultPassword) =>
  `${application.adminNote ? `${application.adminNote}\n\n` : ""}Your account has been created/verified.\n\nUse your registered phone number as both the login ID and temporary password: ${defaultPassword}\n\nFor security, the garage portal will require you to create a new password immediately after your first login.`;

const loadApprovedApplicationResult = async (application) => {
  const garage = await prisma.garage.findUnique({
    where: { id: application.approvedGarageId },
    include: { owner: true, wallet: true, images: true },
  });

  if (!garage) {
    throw new ApiError(409, "Approved garage record is missing for this application");
  }

  const dedupeKey = `garage-application:${application.id}:approved:v1`;
  let email = await prisma.garageApplicationEmailOutbox.findUnique({
    where: { dedupeKey },
  });

  const recipient = garage.owner?.email || application.email;
  if (!email && recipient) {
    email = await enqueueOptionalApplicationEmail({
      applicationId: application.id,
      dedupeKey,
      to: recipient,
      subject: "Rovauto garage application approved",
      message: buildApprovalMessage(application, getDefaultGaragePassword(application.phone)),
    });
  }

  return {
    application,
    garage,
    owner: garage.owner,
    activationRequired: {
      minimumRecharge: GARAGE_MINIMUM_ACTIVATION_RECHARGE,
      message: `Garage is verified but inactive until wallet has at least Rs. ${GARAGE_MINIMUM_ACTIVATION_RECHARGE} verified Cashfree balance.`,
    },
    alreadyApproved: true,
    emailDelivery: await deliverQueuedEmail(email?.id || null),
  };
};

const approveApplication = async (applicationId, adminNote) => {
  const application = await getApplication(applicationId);
  if (application.status === "APPROVED" && application.approvedGarageId) {
    return loadApprovedApplicationResult(application);
  }

  const existingGarage = await prisma.garage.findFirst({
    where: {
      OR: [
        { applicationId },
        ...getGarageIdentityConditions(application),
      ],
    },
  });
  if (existingGarage) {
    throw new ApiError(409, "This application phone or email is already linked to a garage");
  }

  const result = await prisma.$transaction(async (tx) => {
    const defaultPassword = getDefaultGaragePassword(application.phone);
    const defaultPasswordHash = await argon2.hash(defaultPassword);
    const [ownerByPhone, ownerByEmail] = await Promise.all([
      tx.garageOwner.findUnique({ where: { phone: application.phone } }),
      application.email
        ? tx.garageOwner.findUnique({ where: { email: application.email } })
        : null,
    ]);

    if (ownerByPhone && ownerByEmail && ownerByPhone.id !== ownerByEmail.id) {
      throw new ApiError(409, "The application phone and email belong to different garage accounts");
    }

    if (!ownerByPhone && ownerByEmail) {
      throw new ApiError(409, "This email is already linked to another garage phone number");
    }

    const existingOwner = ownerByPhone;
    const ownerEmail = application.email || existingOwner?.email || null;
    const owner = existingOwner
      ? await tx.garageOwner.update({
          where: { id: existingOwner.id },
          data: {
            name: application.ownerName,
            email: ownerEmail,
            phone: application.phone,
            password: defaultPasswordHash,
            passwordChangedAt: null,
            isActive: true,
            isEmailVerified: true,
          },
        })
      : await tx.garageOwner.create({
          data: {
            name: application.ownerName,
            email: ownerEmail,
            phone: application.phone,
            password: defaultPasswordHash,
            passwordChangedAt: null,
            isActive: true,
            isEmailVerified: true,
          },
        });

    await tx.garageOwnerSession.updateMany({
      where: { garageOwnerId: owner.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const garage = await tx.garage.create({
      data: {
        applicationId,
        ownerId: owner.id,
        name: application.garageName,
        description: application.description,
        phone: application.phone,
        whatsappNo: application.phone,
        email: application.email,
        address: application.address,
        city: application.city,
        area: application.area,
        latitude: application.latitude ?? 0,
        longitude: application.longitude ?? 0,
        placeId: application.placeId || null,
        workingRadiusKm: application.workingRadiusKm || 15,
        garageType: normalizeGarageType(application.description?.match(/Garage type:\s*(.+)/i)?.[1]),
        supportedBrands: parseSupportedBrands(application.description?.match(/Brands:\s*(.+)/i)?.[1]),
        isVerified: true,
        isActive: false,
        wallet: { create: { balance: 0 } },
        images: application.images?.length
          ? {
              create: application.images.map((image) => ({
                imageUrl: image.imageUrl,
                publicId: image.publicId,
                order: image.order,
                isThumbnail: image.isThumbnail,
              })),
            }
          : undefined,
      },
      include: { owner: true, wallet: true, images: true },
    });

    const updatedApplication = await tx.garageApplication.update({
      where: { id: applicationId },
      data: {
        status: "APPROVED",
        adminNote:
          adminNote ||
          `Garage approved. Recharge at least Rs. ${GARAGE_MINIMUM_ACTIVATION_RECHARGE} to activate listing.`,
        reviewedAt: new Date(),
        approvedGarageId: garage.id,
      },
      select: applicationSelect,
    });

    const email = await enqueueOptionalApplicationEmail({
      client: tx,
      applicationId,
      dedupeKey: `garage-application:${applicationId}:approved:v1`,
      to: ownerEmail,
      subject: "Rovauto garage application approved",
      message: buildApprovalMessage(updatedApplication, defaultPassword),
    });

    return {
      application: updatedApplication,
      garage,
      owner,
      defaultPassword,
      emailOutboxId: email?.id || null,
      activationRequired: {
        minimumRecharge: GARAGE_MINIMUM_ACTIVATION_RECHARGE,
        message: `Garage is verified but inactive until wallet has at least Rs. ${GARAGE_MINIMUM_ACTIVATION_RECHARGE} verified Cashfree balance.`,
      },
    };
  });

  const emailDelivery = await deliverQueuedEmail(result.emailOutboxId);
  const { emailOutboxId, ...response } = result;
  return { ...response, emailDelivery };
};

const deleteApplications = async (applicationIds = []) => {
  const ids = Array.isArray(applicationIds) ? applicationIds.filter(Boolean) : [];
  if (!ids.length) throw new ApiError(400, "Select at least one application to delete");

  const applications = await prisma.garageApplication.findMany({
    where: {
      id: { in: ids },
      status: { in: ["APPROVED", "DENIED"] },
    },
    select: {
      id: true,
      status: true,
      approvedGarageId: true,
      images: { select: { publicId: true } },
    },
  });

  if (applications.length !== ids.length) {
    throw new ApiError(400, "Only approved or denied applications can be deleted");
  }

  const publicIds = applications.flatMap((application) =>
    application.images.map((image) => image.publicId),
  );
  const result = await prisma.garageApplication.deleteMany({
    where: { id: { in: ids } },
  });

  await deleteCloudinaryImagesIfUnreferenced(publicIds);

  return { deleted: result.count };
};

module.exports = {
  approveApplication,
  deleteApplications,
  denyApplication,
  getApplication,
  listApplications,
  requestChanges,
  submitApplication,
};
