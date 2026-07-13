const prisma = require("../config/prisma");
const otpService = require("../customer/services/otp.service");

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const getArg = (name) => {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
};

const usage = () => {
  console.log(`
Usage:
  node scripts/forceResetGaragePasswords.js --list
  node scripts/forceResetGaragePasswords.js --confirm

Options:
  --list       Show garages / owners that would be affected (dry run)
  --confirm    Actually create reset OTPs and send them to owners
`);
};

const run = async () => {
  if (hasFlag("help")) {
    usage();
    process.exit(0);
  }

  const garages = await prisma.garage.findMany({ include: { owner: true } });
  if (!garages || garages.length === 0) {
    console.log("No garages found in the database.");
    process.exit(0);
  }

  // Map owners by id to avoid duplicates
  const ownersById = new Map();
  garages.forEach((g) => {
    if (g.owner && g.owner.id) ownersById.set(g.owner.id, { id: g.owner.id, email: g.owner.email, name: g.owner.name });
  });

  const owners = Array.from(ownersById.values());

  console.log(`Found ${owners.length} unique garage owner(s) to process.`);

  if (hasFlag("list")) {
    console.log("Sample owners:");
    owners.slice(0, 50).forEach((o) => console.log({ id: o.id, email: o.email, name: o.name }));
    console.log("\nDry run only. Re-run with --confirm to send reset OTPs to all garage owners.");
    process.exit(0);
  }

  if (!hasFlag("confirm")) {
    console.log("Dry run by default. Use --confirm to actually create and send reset OTPs to all garage owners.");
    usage();
    process.exit(0);
  }

  console.log("Creating reset OTPs and sending to owners (this will use the existing OTP/email delivery configuration)...");

  let success = 0;
  let failed = 0;

  for (const owner of owners) {
    try {
      // createGarageResetPasswordOtp generates a two-hour OTP, stores its hash, and sends it.
      // IMPORTANT: This script will NOT print OTPs itself. If your environment is configured to preview email OTPs
      // (EMAIL_OTP_DELIVERY !== 'email'), the OTP may appear in server logs from the email preview. That is expected
      // for development environments but is insecure for production.
      await otpService.createGarageResetPasswordOtp(owner.id, owner.email);
      console.log(`Sent reset OTP to ${owner.email} (userId=${owner.id})`);
      success++;
    } catch (err) {
      console.error(`Failed for ${owner.email} (userId=${owner.id}):`, err.message || err);
      failed++;
    }
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
  if (failed > 0) process.exit(2);
  process.exit(0);
};

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
