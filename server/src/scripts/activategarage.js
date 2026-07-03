#!/usr/bin/env node

const prisma = require("../config/prisma");
const applicationService = require("../garage/services/application.service");

const args = process.argv.slice(2);

const getArg = (name) => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : "";
};

const hasFlag = (name) => args.includes(`--${name}`);

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizePhone = (phone) => String(phone || "").trim();

const usage = () => {
  console.log(`
Usage:
  node src/scripts/activateGarage.js --list
  node src/scripts/activateGarage.js --garage-id=<garage-id> [--confirm]
  node src/scripts/activateGarage.js --application-id=<application-id> [--confirm]
  node src/scripts/activateGarage.js --email=owner@example.com [--confirm]
  node src/scripts/activateGarage.js --phone=+919812345678 [--confirm]
  node src/scripts/activateGarage.js --garage-name="Garage Name" [--confirm]

Dry-run is default. Add --confirm to approve and activate.
`);
};

const printGarage = (g) => {
  console.log({
    id: g.id,
    name: g.name,
    email: g.email,
    phone: g.phone,
    isVerified: g.isVerified,
    isActive: g.isActive,
    applicationId: g.applicationId,
    createdAt: g.createdAt,
  });
};

const listPending = async () => {
  const inactiveGarages = await prisma.garage.findMany({
    where: { isActive: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const pendingApps = await prisma.garageApplication.findMany({
    where: { status: { in: ["PENDING", "CHANGES_REQUESTED"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  console.log(`Inactive garages (${inactiveGarages.length}):`);
  inactiveGarages.forEach(printGarage);

  console.log("\nPending/changes-requested applications:");
  pendingApps.forEach((a) =>
    console.log({
      id: a.id,
      ownerName: a.ownerName,
      email: a.email,
      phone: a.phone,
      garageName: a.garageName,
      status: a.status,
      createdAt: a.createdAt,
    })
  );
};

const buildWhereForGarage = ({ garageId, applicationId, garageName }) => {
  if (garageId) return { id: garageId };
  if (applicationId) return { applicationId };
  if (garageName) return { name: { equals: garageName, mode: "insensitive" } };
  return null;
};

const buildWhereForApplication = ({ applicationId, email, phone, garageName }) => {
  const OR = [];

  if (applicationId) OR.push({ id: applicationId });
  if (email) OR.push({ email: normalizeEmail(email) });
  if (phone) OR.push({ phone: normalizePhone(phone) });
  if (garageName) OR.push({ garageName: { equals: garageName, mode: "insensitive" } });

  return OR.length ? { OR } : null;
};

const activateGarageById = async (garageId) => {
  const garage = await prisma.garage.findUnique({
    where: { id: garageId },
  });

  if (!garage) {
    console.error("Garage not found with id:", garageId);
    return null;
  }

  if (garage.isActive) {
    console.log("Garage is already active:");
    printGarage(garage);
    return garage;
  }

  const updated = await prisma.garage.update({
    where: { id: garageId },
    data: { isActive: true },
  });

  console.log("Activated garage:");
  printGarage(updated);

  return updated;
};

const run = async () => {
  if (hasFlag("help")) {
    usage();
    return;
  }

  if (hasFlag("list")) {
    await listPending();
    return;
  }

  const garageId = getArg("garage-id");
  const applicationId = getArg("application-id");
  const email = getArg("email");
  const phone = getArg("phone");
  const garageName = getArg("garage-name");
  const note = getArg("note") || undefined;

  if (!garageId && !applicationId && !email && !phone && !garageName) {
    usage();
    return;
  }

  let garage = null;

  // Only search Garage directly when using actual garage identifiers.
  // For email/phone, search GarageApplication first because garage may not exist yet.
  const shouldSearchGarageFirst = Boolean(garageId || applicationId || garageName);

  if (shouldSearchGarageFirst) {
    const garageWhere = buildWhereForGarage({
      garageId,
      applicationId,
      garageName,
    });

    console.log("garageWhere:", JSON.stringify(garageWhere, null, 2));

    garage = garageWhere
      ? await prisma.garage.findFirst({ where: garageWhere })
      : null;
  }

  if (garage) {
    console.log("Found garage:");
    printGarage(garage);

    if (!hasFlag("confirm")) {
      console.log("\nDry-run: re-run with --confirm to activate this garage.");
      return;
    }

    await activateGarageById(garage.id);
    return;
  }

  const appWhere = buildWhereForApplication({
    applicationId,
    email,
    phone,
    garageName,
  });

  if (!appWhere) {
    console.error("No search criteria resolved to an application or garage.");
    return;
  }

  console.log("applicationWhere:", JSON.stringify(appWhere, null, 2));

  const applications = await prisma.garageApplication.findMany({
    where: {
      ...appWhere,
      status: { in: ["PENDING", "CHANGES_REQUESTED", "APPROVED"] },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!applications.length) {
    console.error("No matching garage application found.");
    return;
  }

  if (applications.length > 1) {
    console.log(
      `Matched ${applications.length} applications. Re-run with --application-id=<id>.`
    );

    applications.forEach((a) =>
      console.log({
        id: a.id,
        ownerName: a.ownerName,
        email: a.email,
        phone: a.phone,
        garageName: a.garageName,
        status: a.status,
      })
    );

    return;
  }

  const application = applications[0];

  console.log("Matched application:");
  console.log({
    id: application.id,
    ownerName: application.ownerName,
    email: application.email,
    phone: application.phone,
    garageName: application.garageName,
    status: application.status,
    approvedGarageId: application.approvedGarageId,
    createdAt: application.createdAt,
  });

  if (!hasFlag("confirm")) {
    console.log("\nDry-run: re-run with --confirm to approve and activate.");
    return;
  }

  let result;

  if (application.status !== "APPROVED") {
    console.log("Approving application now...");

    result = await applicationService.approveApplication(application.id, note);

    console.log("Application approved:");
    console.log({
      applicationId: result.application?.id,
      approvedGarageId:
        result.garage?.id || result.application?.approvedGarageId,
      ownerId: result.owner?.id,
      ownerEmail: result.owner?.email,
    });
  } else {
    console.log("Application already approved. Fetching linked garage...");

    const linkedGarageId = application.approvedGarageId;

    const linkedGarage = linkedGarageId
      ? await prisma.garage.findUnique({ where: { id: linkedGarageId } })
      : await prisma.garage.findFirst({
          where: { applicationId: application.id },
        });

    const owner = await prisma.user.findUnique({
      where: { email: normalizeEmail(application.email) },
    });

    result = {
      application,
      garage: linkedGarage,
      owner,
    };
  }

  const garageIdToActivate =
    result.garage?.id || result.application?.approvedGarageId;

  if (!garageIdToActivate) {
    console.error("Could not determine garage id after approval.");
    return;
  }

  await activateGarageById(garageIdToActivate);

  if (result.defaultPassword) {
    console.log(
      `Default password for owner (${result.owner?.email || application.email}): ${
        result.defaultPassword
      }`
    );
  }
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FULL ERROR:");
    console.error(err);

    console.error("ERROR DETAILS:");
    console.dir(err, { depth: null });

    process.exit(2);
  });
