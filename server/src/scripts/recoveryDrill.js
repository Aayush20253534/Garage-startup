const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Client } = require("pg");

require("dotenv").config();

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
const recoveryUrl = String(process.env.RECOVERY_TEST_DATABASE_URL || "").trim();

if (!sourceUrl || !recoveryUrl) {
  throw new Error("DATABASE_URL and RECOVERY_TEST_DATABASE_URL are required");
}

const normalizeDatabaseTarget = (value) => {
  const url = new URL(value);
  return `${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`;
};

const sourceTarget = normalizeDatabaseTarget(sourceUrl);
const recoveryTarget = normalizeDatabaseTarget(recoveryUrl);
const recoveryDatabaseName = new URL(recoveryUrl).pathname.replace(/^\//, "").toLowerCase();

if (sourceTarget === recoveryTarget) {
  throw new Error("Recovery drill database must never be the production database");
}

if (!/(test|recovery|restore|staging|drill)/i.test(recoveryDatabaseName)) {
  throw new Error(
    "RECOVERY_TEST_DATABASE_URL database name must contain test, recovery, restore, staging, or drill",
  );
}

const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "rovauto-recovery-"));
const dumpPath = path.join(workDirectory, "production-snapshot.dump");
const startedAt = Date.now();

const run = (command, args) =>
  execFileSync(command, args, { stdio: "inherit" });

const verifyRestoredDatabase = async () => {
  const client = new Client({ connectionString: recoveryUrl });
  await client.connect();

  try {
    const tables = await client.query(`
      SELECT
        to_regclass('public."User"') AS users,
        to_regclass('public."Booking"') AS bookings,
        to_regclass('public."Payment"') AS payments,
        to_regclass('public."_prisma_migrations"') AS migrations
    `);

    const missing = Object.entries(tables.rows[0] || {})
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length) {
      throw new Error(`Restored database is missing required tables: ${missing.join(", ")}`);
    }

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM "User") AS users,
        (SELECT COUNT(*)::bigint FROM "Booking") AS bookings,
        (SELECT COUNT(*)::bigint FROM "Payment") AS payments
    `);

    return counts.rows[0];
  } finally {
    await client.end();
  }
};

(async () => {
  try {
    run("pg_dump", [
      "--format=custom",
      "--compress=6",
      "--no-owner",
      "--no-acl",
      `--file=${dumpPath}`,
      sourceUrl,
    ]);

    if (!fs.existsSync(dumpPath) || fs.statSync(dumpPath).size < 1024) {
      throw new Error("Recovery drill dump is missing or unexpectedly small");
    }

    run("pg_restore", [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      `--dbname=${recoveryUrl}`,
      dumpPath,
    ]);

    const counts = await verifyRestoredDatabase();

    console.log(JSON.stringify({
      success: true,
      sourceTarget,
      recoveryTarget,
      durationMs: Date.now() - startedAt,
      restoredCounts: counts,
      completedAt: new Date().toISOString(),
    }, null, 2));
  } finally {
    fs.rmSync(workDirectory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error("Recovery drill failed:", error.message);
  process.exitCode = 1;
});
