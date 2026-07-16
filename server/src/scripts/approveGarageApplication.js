require("dotenv/config");

const prisma = require("../config/prisma");
const applicationService = require("../garage/services/application.service");
const { normalizeEmail } = require("../utils/email");

const args = process.argv.slice(2);

const getArg = (name) => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : "";
};

const hasFlag = (name) => args.includes(`--${name}`);

const normalizePhone = (phone) => String(phone || "").trim();

const usage = () => {
  console.log(`
Usage:
  npm run db:approve-garage -- --id=application-id
  npm run db:approve-garage -- --email=owner@example.com
  npm run db:approve-garage -- --phone=9812345678
  npm run db:approve-garage -- --garage-name="Garage Name"
  npm run db:approve-garage -- --list

Dry-run is the default. Add --confirm to approve.
Use --note="custom admin note" to override the approval note.

Examples:
  npm run db:approve-garage -- --list
  npm run db:approve-garage -- --email=owner@example.com
  npm run db:approve-garage -- --email=owner@example.com --confirm
`);
};

const printApplication = (application) => {
  console.log({
    id: application.id,
    status: application.status,
    ownerName: application.ownerName,
    email: application.email,
    phone: application.phone,
    garageName: application.garageName,
    city: application.city,
    area: application.area,
    approvedGarageId: application.approvedGarageId,
    createdAt: application.createdAt,
  });
};

const listPendingApplications = async () => {
  const applications = await prisma.garageApplication.findMany({
    where: { status: { in: ["PENDING", "CHANGES_REQUESTED"] } },
    orderBy: { createdAt: "desc" },
  });

  if (applications.length === 0) {
    console.log("No pending garage applications found.");
    return;
  }

  console.log(`Found ${applications.length} pending/changes-requested garage application(s):`);
  applications.forEach(printApplication);
};

const buildWhere = () => {
  const id = getArg("id");
  const email = normalizeEmail(getArg("email"));
  const phone = normalizePhone(getArg("phone"));
  const garageName = getArg("garage-name");
  const OR = [];

  if (id) OR.push({ id });
  if (email) OR.push({ email });
  if (phone) OR.push({ phone });
  if (garageName) OR.push({ garageName: { equals: garageName, mode: "insensitive" } });

  return OR.length ? { OR } : null;
};

const approveGarageApplication = async () => {
  if (hasFlag("help")) {
    usage();
    return;
  }

  if (hasFlag("list")) {
    await listPendingApplications();
    return;
  }

  const where = buildWhere();
  if (!where) {
    usage();
    return;
  }

  const applications = await prisma.garageApplication.findMany({
    where: {
      ...where,
      status: { in: ["PENDING", "CHANGES_REQUESTED"] },
    },
    orderBy: { createdAt: "asc" },
  });

  if (applications.length === 0) {
    console.log("No matching pending garage application found.");
    return;
  }

  if (applications.length > 1) {
    console.log(`Matched ${applications.length} applications. Re-run with --id=<application-id> to approve exactly one.`);
    applications.forEach(printApplication);
    return;
  }

  const application = applications[0];
  console.log("Matched garage application:");
  printApplication(application);

  if (!hasFlag("confirm")) {
    console.log("\nDry-run only. Re-run with --confirm to approve this application.");
    return;
  }

  const note = getArg("note") || undefined;
  const result = await applicationService.approveApplication(application.id, note);

  console.log("\nApproved garage application successfully:");
  console.log({
    applicationId: result.application.id,
    garageId: result.garage.id,
    ownerId: result.owner.id,
    ownerEmail: result.owner.email,
    isVerified: result.garage.isVerified,
    isActive: result.garage.isActive,
    activationRequired: result.activationRequired,
  });
};

approveGarageApplication()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
