const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config();

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const backupDirectory = path.resolve(
  process.env.BACKUP_DIRECTORY || path.join(process.cwd(), "backups"),
);
fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = path.join(backupDirectory, `rovauto-${timestamp}.dump`);

execFileSync(
  "pg_dump",
  [
    "--format=custom",
    "--compress=9",
    "--no-owner",
    "--no-acl",
    `--file=${outputPath}`,
    databaseUrl,
  ],
  { stdio: "inherit" },
);

const stats = fs.statSync(outputPath);
if (stats.size < 1024) {
  fs.rmSync(outputPath, { force: true });
  throw new Error("Backup file is unexpectedly small; backup was rejected");
}

console.log(JSON.stringify({
  success: true,
  outputPath,
  sizeBytes: stats.size,
  createdAt: new Date().toISOString(),
}, null, 2));
