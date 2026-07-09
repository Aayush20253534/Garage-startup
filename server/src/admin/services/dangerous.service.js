const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { Client } = require("pg");

const prisma = require("../../config/prisma");
const ApiError = require("../../utils/apiError");
const { deletePattern } = require("../../utils/cache");
const { deleteFromCloudinary } = require("../../utils/cloudinaryUpload");

const ACTIVE_BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "SEARCHING_GARAGE",
  "GARAGE_ASSIGNED",
  "CONFIRMED",
  "IN_PROGRESS",
];

const SERVICE_HISTORY_STATUSES = ["COMPLETED"];

const COMMANDS = [
  {
    command: "migrate-deploy",
    label: "Run Prisma migrate deploy",
    description: "Runs the production Prisma migration deploy command.",
    tone: "warning",
    fields: [],
  },
  {
    command: "reset-service-coming-soon",
    label: "Reset service coming soon flags",
    description: "Sets isComingSoon=false on every service.",
    tone: "warning",
    fields: [],
  },
  {
    command: "download-db-backup",
    label: "Download current database as .db",
    description:
      "Exports the current PostgreSQL database into a SQLite .db snapshot that can be opened in DB Browser for SQLite and most .db viewers. This does not delete or modify data, but the downloaded file contains sensitive production data.",
    tone: "warning",
    fields: [],
    action: "download",
  },
  {
    command: "delete-user-data",
    label: "Delete specific user and linked records",
    description:
      "Deletes a matched user, all customer/owner records, booking data, wallet data, OTP/signup artifacts, cache, and DB-backed Cloudinary media.",
    tone: "danger",
    fields: ["targetType", "targetValue"],
  },
  {
    command: "delete-garage-data",
    label: "Delete specific garage and linked records",
    description:
      "Deletes one matched garage, its bookings, broadcasts, services, wallet, reviews, application records, cache, and DB-backed Cloudinary media. The garage owner user account is not deleted.",
    tone: "danger",
    fields: ["garageTargetType", "garageTargetValue"],
  },
  {
    command: "delete-customer-active-bookings",
    label: "Delete customer active bookings",
    description:
      "Deletes active bookings for one customer email, including related booking records and inspection images.",
    tone: "danger",
    fields: ["customerEmail"],
  },
  {
    command: "delete-customer-payments",
    label: "Delete customer payment records",
    description:
      "Deletes platform payment rows and customer wallet transactions for one customer email.",
    tone: "danger",
    fields: ["customerEmail"],
  },
  {
    command: "delete-customer-service-history",
    label: "Delete customer service history",
    description:
      "Deletes completed booking history for one customer email, including related booking records and inspection images.",
    tone: "danger",
    fields: ["customerEmail"],
  },
  {
    command: "delete-all-bookings",
    label: "Delete all bookings",
    description:
      "Deletes every booking and cascaded booking records, detaches complaints, and removes inspection images from Cloudinary.",
    tone: "danger",
    fields: [],
  },
  {
    command: "delete-all-payments",
    label: "Delete all payment and wallet transactions",
    description:
      "Deletes all Cashfree payment rows plus customer and garage wallet transactions, then resets wallet balances to zero.",
    tone: "danger",
    fields: [],
  },
  {
    command: "delete-all-garages",
    label: "Delete all garages",
    description:
      "Deletes garages, garage services, garage wallets, garage bookings, garage applications, and DB-backed garage media in Cloudinary.",
    tone: "danger",
    fields: [],
  },
  {
    command: "delete-all-garage-applications",
    label: "Delete all garage applications",
    description:
      "Deletes all pending/approved garage applications and application images from Cloudinary.",
    tone: "danger",
    fields: [],
  },
  {
    command: "delete-all-services",
    label: "Delete service catalog",
    description:
      "Deletes service categories, services, service media, garage-service mappings, and city price ranges. Cloudinary service images/videos are removed.",
    tone: "danger",
    fields: [],
  },
  {
    command: "delete-all-vehicle-metadata",
    label: "Delete vehicle brand/model metadata",
    description: "Deletes every vehicle brand and model from the admin catalog.",
    tone: "danger",
    fields: [],
  },
  {
    command: "delete-all-cities",
    label: "Delete city records",
    description: "Deletes every city row used by admin filters and availability.",
    tone: "danger",
    fields: [],
  },
  {
    command: "delete-all-notifications",
    label: "Delete all notifications",
    description: "Deletes all customer notifications.",
    tone: "danger",
    fields: [],
  },
  {
    command: "delete-all-system-issues",
    label: "Delete all system issues",
    description: "Deletes all frontend/backend issue reports from the admin issue tracker.",
    tone: "danger",
    fields: [],
  },
  {
    command: "nuke-users",
    label: "Nuke all users",
    description:
      "Deletes every customer and garage-owner account, user-linked bookings, wallets, OTPs, notifications, activities, chatbot data, and user media in Cloudinary. Garages are preserved but owner links are cleared.",
    tone: "critical",
    fields: [],
  },
  {
    command: "nuke-platform",
    label: "Nuke platform data",
    description:
      "Deletes all non-staff platform data: users, garages, bookings, payments, applications, services, cities, vehicle metadata, notifications, system issues, and DB-backed Cloudinary media.",
    tone: "critical",
    fields: [],
  },
];

const COMMAND_BY_NAME = new Map(COMMANDS.map((item) => [item.command, item]));

const unique = (values = []) => [...new Set(values.filter(Boolean))];
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizeString = (value) => String(value || "").trim();

const normalizePhoneLoose = (phone) => {
  const raw = normalizeString(phone);
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;

  return `+${digits}`;
};

const phoneCandidates = (phone) => {
  const raw = normalizeString(phone);
  const digits = raw.replace(/\D/g, "");
  const lastTen = digits.length >= 10 ? digits.slice(-10) : "";

  return unique([
    raw,
    digits,
    digits ? `+${digits}` : "",
    normalizePhoneLoose(raw),
    lastTen,
    lastTen ? `+91${lastTen}` : "",
  ]);
};

const asImageAssets = (rows = []) =>
  rows
    .map((row) => row?.publicId)
    .filter(Boolean)
    .map((publicId) => ({ publicId, resourceType: "image" }));

const asVideoAssets = (rows = []) =>
  rows
    .map((row) => row?.publicId)
    .filter(Boolean)
    .map((publicId) => ({ publicId, resourceType: "video" }));

const dedupeAssets = (assets = []) => {
  const seen = new Set();
  return assets.filter((asset) => {
    if (!asset?.publicId) return false;
    const resourceType = asset.resourceType || "image";
    const key = `${resourceType}:${asset.publicId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const deleteCloudinaryAssets = async (assets = []) => {
  const uniqueAssets = dedupeAssets(assets);
  const results = await Promise.allSettled(
    uniqueAssets.map((asset) =>
      deleteFromCloudinary(asset.publicId, asset.resourceType || "image"),
    ),
  );

  return {
    requested: uniqueAssets.length,
    deleted: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
};

const getExpectedConfirmation = (command) => `rovauto ${command}`;

const assertConfirmation = ({ command, confirmation }) => {
  const expected = getExpectedConfirmation(command);

  if (normalizeString(confirmation) !== expected) {
    throw new ApiError(400, `Type ${expected} to continue`);
  }
};

const assertCommand = (command) => {
  const metadata = COMMAND_BY_NAME.get(command);

  if (!metadata) {
    throw new ApiError(404, "Dangerous command not found");
  }

  return metadata;
};

const listCommands = () =>
  COMMANDS.map((item) => ({
    ...item,
    confirmation: getExpectedConfirmation(item.command),
  }));

const quoteSqliteIdentifier = (identifier) =>
  `"${String(identifier).replace(/"/g, '""')}"`;

const quotePgIdentifier = (identifier) =>
  `"${String(identifier).replace(/"/g, '""')}"`;

const getSqliteTableName = ({ schema, tableName }) =>
  schema === "public" ? tableName : `${schema}__${tableName}`;

const mapPostgresTypeToSqlite = (column) => {
  const type = String(column.data_type || column.udt_name || "").toLowerCase();
  const udt = String(column.udt_name || "").toLowerCase();

  if (["smallint", "integer", "bigint", "smallserial", "serial", "bigserial"].includes(type)) {
    return "INTEGER";
  }

  if (["int2", "int4", "int8"].includes(udt)) {
    return "INTEGER";
  }

  if (["real", "double precision", "numeric", "decimal"].includes(type)) {
    return "REAL";
  }

  if (["float4", "float8", "numeric"].includes(udt)) {
    return "REAL";
  }

  if (type === "boolean" || udt === "bool") {
    return "INTEGER";
  }

  if (type === "bytea") {
    return "BLOB";
  }

  return "TEXT";
};

const serializeSqliteValue = (value) => {
  if (value === null || value === undefined) return "NULL";

  if (Buffer.isBuffer(value)) {
    return `X'${value.toString("hex")}'`;
  }

  if (value instanceof Date) {
    return `'${value.toISOString().replace(/'/g, "''")}'`;
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  return `'${stringValue.replace(/'/g, "''")}'`;
};

const writeSql = (stream, chunk) =>
  new Promise((resolve, reject) => {
    stream.write(chunk, "utf8", (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const endSqlStream = (stream) =>
  new Promise((resolve, reject) => {
    stream.once("error", reject);
    stream.end(resolve);
  });

const buildPgClient = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new ApiError(500, "DATABASE_URL is missing, so a .db backup cannot be created");
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new ApiError(500, "DATABASE_URL is not a valid PostgreSQL connection URL");
  }

  const sslMode = parsed.searchParams.get("sslmode");
  const config = { connectionString: databaseUrl };

  if (sslMode && sslMode !== "disable") {
    config.ssl = {
      rejectUnauthorized: sslMode === "verify-ca" || sslMode === "verify-full",
    };
  }

  return new Client(config);
};

const fetchBackupTables = async (client) => {
  const { rows } = await client.query(`
    SELECT table_schema AS schema, table_name AS "tableName"
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  `);

  return rows;
};

const fetchTableColumns = async (client, { schema, tableName }) => {
  const { rows } = await client.query(
    `
      SELECT column_name, data_type, udt_name, is_nullable, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `,
    [schema, tableName],
  );

  return rows;
};

const fetchPrimaryKeyColumns = async (client, { schema, tableName }) => {
  const { rows } = await client.query(
    `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY kcu.ordinal_position
    `,
    [schema, tableName],
  );

  return rows.map((row) => row.column_name);
};

const runSqliteImport = ({ sqliteBin, dbPath, sqlPath }) =>
  new Promise((resolve, reject) => {
    const child = spawn(sqliteBin, [dbPath], {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      fail(new ApiError(500, "SQLite .db export timed out"));
    }, Number(process.env.SQLITE_BACKUP_TIMEOUT_MS || 300000));

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      fail(
        new ApiError(
          500,
          `${sqliteBin} could not be started. Install sqlite3 or set SQLITE3_BIN. ${error.message}`,
        ),
      );
    });

    child.once("close", (code) => {
      clearTimeout(timer);

      if (settled) return;
      settled = true;

      if (code !== 0) {
        reject(
          new ApiError(
            500,
            stderr.trim() || stdout.trim() || `SQLite export exited with ${code}`,
          ),
        );
        return;
      }

      resolve({ stdout, stderr });
    });

    const input = fs.createReadStream(sqlPath);
    input.once("error", (error) => {
      child.kill("SIGTERM");
      clearTimeout(timer);
      fail(error);
    });
    input.pipe(child.stdin);
  });

const createSqliteBackupFile = async ({ command, confirmation } = {}) => {
  const metadata = assertCommand(command);

  if (metadata.action !== "download") {
    throw new ApiError(400, "This command does not support file downloads");
  }

  assertConfirmation({ command, confirmation });

  const fileStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `rovauto-db-backup-${fileStamp}`;
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "rovauto-db-"));
  const sqlPath = path.join(tempDir, `${baseName}.sqlite-import.sql`);
  const dbPath = path.join(tempDir, `${baseName}.db`);
  const sqliteBin = process.env.SQLITE3_BIN || (process.platform === "win32" ? "sqlite3.exe" : "sqlite3");
  const client = buildPgClient();
  const sqlStream = fs.createWriteStream(sqlPath, { encoding: "utf8" });

  try {
    await client.connect();
    const tables = await fetchBackupTables(client);

    await writeSql(sqlStream, "PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n\n");

    for (const table of tables) {
      const sqliteTableName = getSqliteTableName(table);
      const columns = await fetchTableColumns(client, table);
      const primaryKeys = await fetchPrimaryKeyColumns(client, table);

      if (!columns.length) continue;

      const columnDefinitions = columns.map((column) => {
        const nullable = column.is_nullable === "NO" ? " NOT NULL" : "";
        return `${quoteSqliteIdentifier(column.column_name)} ${mapPostgresTypeToSqlite(column)}${nullable}`;
      });

      if (primaryKeys.length) {
        columnDefinitions.push(
          `PRIMARY KEY (${primaryKeys.map(quoteSqliteIdentifier).join(", ")})`,
        );
      }

      await writeSql(
        sqlStream,
        `DROP TABLE IF EXISTS ${quoteSqliteIdentifier(sqliteTableName)};\n` +
          `CREATE TABLE ${quoteSqliteIdentifier(sqliteTableName)} (\n  ${columnDefinitions.join(",\n  ")}\n);\n`,
      );

      const pgTableName = `${quotePgIdentifier(table.schema)}.${quotePgIdentifier(table.tableName)}`;
      const pgColumnNames = columns.map((column) => quotePgIdentifier(column.column_name)).join(", ");
      const sqliteColumnNames = columns.map((column) => quoteSqliteIdentifier(column.column_name)).join(", ");
      const pageSize = Number(process.env.SQLITE_BACKUP_PAGE_SIZE || 500);
      let offset = 0;

      while (true) {
        const { rows } = await client.query(
          `SELECT ${pgColumnNames} FROM ${pgTableName} LIMIT $1 OFFSET $2`,
          [pageSize, offset],
        );

        if (!rows.length) break;

        for (const row of rows) {
          const values = columns
            .map((column) => serializeSqliteValue(row[column.column_name]))
            .join(", ");
          await writeSql(
            sqlStream,
            `INSERT INTO ${quoteSqliteIdentifier(sqliteTableName)} (${sqliteColumnNames}) VALUES (${values});\n`,
          );
        }

        offset += rows.length;
      }

      await writeSql(sqlStream, "\n");
    }

    await writeSql(sqlStream, "COMMIT;\nPRAGMA foreign_keys=ON;\nVACUUM;\n");
    await endSqlStream(sqlStream);

    await runSqliteImport({ sqliteBin, dbPath, sqlPath });

    await fs.promises.unlink(sqlPath).catch(() => {});

    return {
      filePath: dbPath,
      filename: `${baseName}.db`,
      cleanupPaths: [dbPath, tempDir],
    };
  } catch (error) {
    sqlStream.destroy();
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
};

const runFixedProcess = (bin, args, { timeoutMs = 120000 } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
      },
      shell: process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new ApiError(500, "Command timed out"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        reject(
          new ApiError(
            500,
            stderr.trim() || stdout.trim() || `Command exited with ${code}`,
          ),
        );
        return;
      }

      resolve({
        exitCode: code,
        stdout: stdout.slice(-8000),
        stderr: stderr.slice(-8000),
      });
    });
  });

const buildUserWhereFromPayload = (payload = {}) => {
  const targetType = normalizeString(payload.targetType);
  const targetValue = normalizeString(payload.targetValue);
  const id = normalizeString(payload.userId || payload.id);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhoneLoose(payload.phone);
  const name = normalizeString(payload.name);
  const OR = [];

  if (id) OR.push({ id });
  if (email) OR.push({ email });
  if (phone) OR.push({ phone });
  if (name) OR.push({ name });

  if (targetType && targetValue) {
    if (targetType === "id") OR.push({ id: targetValue });
    if (targetType === "email") OR.push({ email: normalizeEmail(targetValue) });
    if (targetType === "phone") OR.push({ phone: normalizePhoneLoose(targetValue) });
    if (targetType === "name") OR.push({ name: targetValue });
  }

  return OR.length ? { OR } : null;
};

const findSelectedUsers = async (payload = {}) => {
  const where = buildUserWhereFromPayload(payload);

  if (!where) {
    throw new ApiError(400, "Provide a user id, email, phone, or name");
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (users.length === 0) {
    throw new ApiError(404, "No matching users found");
  }

  const explicitId =
    Boolean(normalizeString(payload.userId || payload.id)) ||
    (normalizeString(payload.targetType) === "id" &&
      Boolean(normalizeString(payload.targetValue)));

  if (users.length > 1 && !explicitId) {
    throw new ApiError(
      400,
      `Matched ${users.length} users. Re-run with target type ID for exactly one user.`,
    );
  }

  return users;
};

const buildGarageWhereFromPayload = (payload = {}) => {
  const targetType = normalizeString(payload.garageTargetType || payload.targetType);
  const targetValue = normalizeString(payload.garageTargetValue || payload.targetValue);
  const id = normalizeString(payload.garageId || payload.id);
  const email = normalizeEmail(payload.garageEmail || payload.email);
  const phone = normalizeString(payload.garagePhone || payload.phone);
  const name = normalizeString(payload.garageName || payload.name);
  const OR = [];

  if (id) OR.push({ id });
  if (email) {
    OR.push({ email });
    OR.push({ owner: { is: { email } } });
  }
  if (phone) {
    const phones = phoneCandidates(phone);
    OR.push({ phone: { in: phones } });
    OR.push({ whatsappNo: { in: phones } });
    OR.push({ owner: { is: { phone: { in: phones } } } });
  }
  if (name) OR.push({ name });

  if (targetType && targetValue) {
    if (targetType === "id") OR.push({ id: targetValue });
    if (targetType === "email") {
      const normalizedEmail = normalizeEmail(targetValue);
      OR.push({ email: normalizedEmail });
      OR.push({ owner: { is: { email: normalizedEmail } } });
    }
    if (targetType === "phone") {
      const phones = phoneCandidates(targetValue);
      OR.push({ phone: { in: phones } });
      OR.push({ whatsappNo: { in: phones } });
      OR.push({ owner: { is: { phone: { in: phones } } } });
    }
    if (targetType === "name") OR.push({ name: targetValue });
  }

  return OR.length ? { OR } : null;
};

const findSelectedGarage = async (payload = {}) => {
  const where = buildGarageWhereFromPayload(payload);

  if (!where) {
    throw new ApiError(400, "Provide a garage id, email, phone, or exact name");
  }

  const garages = await prisma.garage.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      area: true,
      ownerId: true,
      applicationId: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (garages.length === 0) {
    throw new ApiError(404, "No matching garages found");
  }

  const explicitId =
    Boolean(normalizeString(payload.garageId || payload.id)) ||
    (normalizeString(payload.garageTargetType || payload.targetType) === "id" &&
      Boolean(normalizeString(payload.garageTargetValue || payload.targetValue)));

  if (garages.length > 1 && !explicitId) {
    throw new ApiError(
      400,
      `Matched ${garages.length} garages. Re-run with target type ID for exactly one garage.`,
    );
  }

  if (garages.length > 1) {
    throw new ApiError(
      400,
      `Matched ${garages.length} garages for this ID payload. Check the identifier and try again.`,
    );
  }

  return garages[0];
};

const buildPendingSignupOr = ({ emails = [], phones = [] } = {}) => {
  const OR = [];
  if (emails.length) OR.push({ email: { in: emails } });
  if (phones.length) OR.push({ phone: { in: phones } });
  return OR;
};

const collectGarageMedia = async (garageIds = [], applicationWhere = null) => {
  const ids = unique(garageIds);

  const [garageImages, garageVideos, inspectionImages, applicationImages] =
    await Promise.all([
      ids.length
        ? prisma.garageImage.findMany({
            where: { garageId: { in: ids } },
            select: { publicId: true },
          })
        : [],
      ids.length
        ? prisma.garageVideo.findMany({
            where: { garageId: { in: ids } },
            select: { publicId: true },
          })
        : [],
      ids.length
        ? prisma.bookingInspectionImage.findMany({
            where: { garageId: { in: ids } },
            select: { publicId: true },
          })
        : [],
      applicationWhere
        ? prisma.garageApplicationImage.findMany({
            where: { application: { is: applicationWhere } },
            select: { publicId: true },
          })
        : [],
    ]);

  return [
    ...asImageAssets(garageImages),
    ...asVideoAssets(garageVideos),
    ...asImageAssets(inspectionImages),
    ...asImageAssets(applicationImages),
  ];
};

const collectUserMedia = async (userIds = [], { includeOwnedGarages = false } = {}) => {
  const ids = unique(userIds);
  if (!ids.length) return [];

  const [profiles, complaintImages, inspectionImages, ownedGarages] =
    await Promise.all([
      prisma.customerProfile.findMany({
        where: { userId: { in: ids } },
        select: { avatarPublicId: true },
      }),
      prisma.complaintImage.findMany({
        where: {
          complaint: {
            is: {
              OR: [
                { userId: { in: ids } },
                { booking: { is: { userId: { in: ids } } } },
              ],
            },
          },
        },
        select: { publicId: true },
      }),
      prisma.bookingInspectionImage.findMany({
        where: { booking: { is: { userId: { in: ids } } } },
        select: { publicId: true },
      }),
      includeOwnedGarages
        ? prisma.garage.findMany({
            where: { ownerId: { in: ids } },
            select: { id: true, applicationId: true },
          })
        : [],
    ]);

  const profileAssets = profiles
    .map((profile) => profile.avatarPublicId)
    .filter(Boolean)
    .map((publicId) => ({ publicId, resourceType: "image" }));

  let garageAssets = [];

  if (includeOwnedGarages && ownedGarages.length) {
    const garageIds = ownedGarages.map((garage) => garage.id);
    const applicationIds = unique(
      ownedGarages.map((garage) => garage.applicationId),
    );
    const applicationWhere = {
      OR: [
        { approvedGarageId: { in: garageIds } },
        ...(applicationIds.length ? [{ id: { in: applicationIds } }] : []),
      ],
    };

    garageAssets = await collectGarageMedia(garageIds, applicationWhere);
  }

  return [
    ...profileAssets,
    ...asImageAssets(complaintImages),
    ...asImageAssets(inspectionImages),
    ...garageAssets,
  ];
};

const collectAllDbMedia = async () => {
  const [
    profiles,
    complaintImages,
    inspectionImages,
    garageImages,
    garageVideos,
    serviceMedia,
    categoryThumbnails,
    applicationImages,
  ] = await Promise.all([
    prisma.customerProfile.findMany({ select: { avatarPublicId: true } }),
    prisma.complaintImage.findMany({ select: { publicId: true } }),
    prisma.bookingInspectionImage.findMany({ select: { publicId: true } }),
    prisma.garageImage.findMany({ select: { publicId: true } }),
    prisma.garageVideo.findMany({ select: { publicId: true } }),
    prisma.serviceMedia.findMany({ select: { publicId: true, mediaType: true } }),
    prisma.serviceCategory.findMany({ select: { thumbnailPublicId: true } }),
    prisma.garageApplicationImage.findMany({ select: { publicId: true } }),
  ]);

  return [
    ...profiles
      .map((profile) => profile.avatarPublicId)
      .filter(Boolean)
      .map((publicId) => ({ publicId, resourceType: "image" })),
    ...asImageAssets(complaintImages),
    ...asImageAssets(inspectionImages),
    ...asImageAssets(garageImages),
    ...asVideoAssets(garageVideos),
    ...serviceMedia
      .map((media) => ({
        publicId: media.publicId,
        resourceType: media.mediaType === "VIDEO" ? "video" : "image",
      }))
      .filter((asset) => asset.publicId),
    ...categoryThumbnails
      .map((category) => category.thumbnailPublicId)
      .filter(Boolean)
      .map((publicId) => ({ publicId, resourceType: "image" })),
    ...asImageAssets(applicationImages),
  ];
};

const getApplicationWhereForGarages = async (garageIds = []) => {
  const ids = unique(garageIds);
  if (!ids.length) return null;

  const garages = await prisma.garage.findMany({
    where: { id: { in: ids } },
    select: { id: true, applicationId: true, email: true, phone: true, owner: { select: { email: true, phone: true } } },
  });

  const applicationIds = unique(garages.map((garage) => garage.applicationId));
  const emails = unique(
    garages.flatMap((garage) => [garage.email, garage.owner?.email].map(normalizeEmail)),
  );
  const phones = unique(
    garages.flatMap((garage) => [garage.phone, garage.owner?.phone].map(normalizeString)),
  );

  const OR = [
    { approvedGarageId: { in: ids } },
    ...(applicationIds.length ? [{ id: { in: applicationIds } }] : []),
    ...(emails.length ? [{ email: { in: emails } }] : []),
    ...(phones.length ? [{ phone: { in: phones } }] : []),
  ];

  return { OR };
};

const getApplicationWhereForGarage = (garage = {}) => ({
  OR: [
    { approvedGarageId: garage.id },
    ...(garage.applicationId ? [{ id: garage.applicationId }] : []),
  ],
});

const deleteGaragesInTransaction = async (tx, garageIds = [], applicationWhere = null) => {
  const ids = unique(garageIds);

  if (!ids.length) {
    return {
      deletedBookings: 0,
      complaintsDetached: 0,
      deletedApplications: 0,
      deletedGarages: 0,
    };
  }

  const bookings = await tx.booking.findMany({
    where: { garageId: { in: ids } },
    select: { id: true },
  });
  const bookingIds = bookings.map((booking) => booking.id);

  const detachedComplaints = bookingIds.length
    ? await tx.complaint.updateMany({
        where: { bookingId: { in: bookingIds } },
        data: { bookingId: null },
      })
    : { count: 0 };

  if (bookingIds.length) {
    await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
  }

  const deletedApplications = applicationWhere
    ? await tx.garageApplication.deleteMany({ where: applicationWhere })
    : { count: 0 };

  const deletedGarages = await tx.garage.deleteMany({
    where: { id: { in: ids } },
  });

  return {
    deletedBookings: bookingIds.length,
    complaintsDetached: detachedComplaints.count,
    deletedApplications: deletedApplications.count,
    deletedGarages: deletedGarages.count,
  };
};

const deleteUserData = async ({ payload = {}, requestedById = null } = {}) => {
  const users = await findSelectedUsers(payload);
  const ids = users.map((user) => user.id);
  const emails = unique(users.map((user) => normalizeEmail(user.email)));
  const phones = unique(users.map((user) => normalizeString(user.phone)));
  const deleteOwnedGarages = true;
  const cloudinaryAssets = await collectUserMedia(ids, {
    includeOwnedGarages: deleteOwnedGarages,
  });

  const ownedGarages = deleteOwnedGarages
    ? await prisma.garage.findMany({
        where: { ownerId: { in: ids } },
        select: { id: true },
      })
    : [];
  const ownedGarageIds = ownedGarages.map((garage) => garage.id);
  const applicationWhere = deleteOwnedGarages
    ? await getApplicationWhereForGarages(ownedGarageIds)
    : null;

  const result = await prisma.$transaction(
    async (tx) => {
      let garageDeletion = null;

      if (deleteOwnedGarages && ownedGarageIds.length) {
        await tx.systemIssue.updateMany({
          where: { garageId: { in: ownedGarageIds } },
          data: { garageId: null },
        });

        garageDeletion = await deleteGaragesInTransaction(
          tx,
          ownedGarageIds,
          applicationWhere,
        );
      } else {
        await tx.garage.updateMany({
          where: { ownerId: { in: ids } },
          data: { ownerId: null },
        });
      }

      if (emails.length) {
        await tx.emailOtp.deleteMany({ where: { email: { in: emails } } });
      }

      if (phones.length) {
        await tx.phoneOtp.deleteMany({ where: { phone: { in: phones } } });
      }

      const pendingSignupOR = buildPendingSignupOr({ emails, phones });
      if (pendingSignupOR.length) {
        await tx.pendingSignup.deleteMany({ where: { OR: pendingSignupOR } });
      }

      await tx.systemIssue.updateMany({
        where: { userId: { in: ids } },
        data: { userId: null },
      });

      const bookingIds = (
        await tx.booking.findMany({
          where: { userId: { in: ids } },
          select: { id: true },
        })
      ).map((booking) => booking.id);

      if (bookingIds.length) {
        await tx.complaint.updateMany({
          where: { bookingId: { in: bookingIds } },
          data: { bookingId: null },
        });
      }

      const deletedUsers = await tx.user.deleteMany({
        where: { id: { in: ids } },
      });

      return {
        matchedUsers: users,
        deletedUsers: deletedUsers.count,
        deletedOwnedGarages: garageDeletion,
      };
    },
    { timeout: 60000 },
  );

  await Promise.allSettled([deletePattern("customer:*"), deletePattern("garages:*")]);
  const cloudinary = await deleteCloudinaryAssets(cloudinaryAssets);

  console.warn("[admin-dangerous] delete-user-data", {
    requestedById,
    userIds: ids,
    deleteOwnedGarages,
  });

  return {
    ...result,
    cloudinary,
  };
};

const deleteGarageData = async ({ payload = {}, requestedById = null } = {}) => {
  const garage = await findSelectedGarage(payload);
  const garageIds = [garage.id];
  const applicationWhere = getApplicationWhereForGarage(garage);
  const cloudinaryAssets = await collectGarageMedia(garageIds, applicationWhere);

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.systemIssue.updateMany({
        where: { garageId: garage.id },
        data: { garageId: null },
      });

      return deleteGaragesInTransaction(tx, garageIds, applicationWhere);
    },
    { timeout: 60000 },
  );

  await Promise.allSettled([deletePattern("garages:*"), deletePattern("customer:*")]);
  const cloudinary = await deleteCloudinaryAssets(cloudinaryAssets);

  console.warn("[admin-dangerous] delete-garage-data", {
    requestedById,
    garageId: garage.id,
  });

  return {
    matchedGarage: garage,
    ...result,
    cloudinary,
  };
};

const findCustomerByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new ApiError(400, "Customer email is required");
  }

  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail, role: "CUSTOMER" },
    select: { id: true, name: true, email: true, phone: true, role: true },
  });

  if (!user) {
    throw new ApiError(404, `No customer found for email: ${normalizedEmail}`);
  }

  return user;
};

const getBookingWhereForScope = (userId, scope) => {
  if (scope === "active") {
    return { userId, status: { in: ACTIVE_BOOKING_STATUSES } };
  }

  if (scope === "history") {
    return { userId, status: { in: SERVICE_HISTORY_STATUSES } };
  }

  return { userId };
};

const deleteCustomerBookings = async ({ payload = {}, scope }) => {
  const customer = await findCustomerByEmail(payload.customerEmail || payload.email);
  const bookingWhere = getBookingWhereForScope(customer.id, scope);
  const bookings = await prisma.booking.findMany({
    where: bookingWhere,
    select: { id: true, bookingCode: true, status: true },
  });
  const bookingIds = bookings.map((booking) => booking.id);

  const imageRecords = bookingIds.length
    ? await prisma.bookingInspectionImage.findMany({
        where: { bookingId: { in: bookingIds } },
        select: { publicId: true },
      })
    : [];

  const deletion = await prisma.$transaction(async (tx) => {
    const detachedComplaints = bookingIds.length
      ? await tx.complaint.updateMany({
          where: { bookingId: { in: bookingIds } },
          data: { bookingId: null },
        })
      : { count: 0 };

    const deletedBookings = bookingIds.length
      ? await tx.booking.deleteMany({ where: { id: { in: bookingIds } } })
      : { count: 0 };

    return {
      deletedBookings: deletedBookings.count,
      complaintsDetached: detachedComplaints.count,
    };
  });

  await Promise.allSettled([deletePattern("customer:*")]);
  const cloudinary = await deleteCloudinaryAssets(asImageAssets(imageRecords));

  return {
    customer,
    matchedBookings: bookings,
    ...deletion,
    cloudinary,
  };
};

const deleteCustomerPayments = async ({ payload = {} } = {}) => {
  const customer = await findCustomerByEmail(payload.customerEmail || payload.email);
  const bookingIds = (
    await prisma.booking.findMany({
      where: { userId: customer.id },
      select: { id: true },
    })
  ).map((booking) => booking.id);

  const result = await prisma.$transaction(async (tx) => {
    const deletedPayments = bookingIds.length
      ? await tx.payment.deleteMany({ where: { bookingId: { in: bookingIds } } })
      : { count: 0 };

    const deletedWalletTransactions = await tx.walletTransaction.deleteMany({
      where: { userId: customer.id },
    });

    await tx.wallet.updateMany({
      where: { userId: customer.id },
      data: { balance: 0 },
    });

    return {
      customer,
      deletedPayments: deletedPayments.count,
      deletedWalletTransactions: deletedWalletTransactions.count,
    };
  });

  await Promise.allSettled([deletePattern("customer:*")]);
  return result;
};

const deleteAllBookings = async () => {
  const imageRecords = await prisma.bookingInspectionImage.findMany({
    select: { publicId: true },
  });
  const [bookingCount, paymentCount, reviewCount, broadcastCount] =
    await Promise.all([
      prisma.booking.count(),
      prisma.payment.count(),
      prisma.review.count(),
      prisma.garageBroadcastRequest.count(),
    ]);

  const deletion = await prisma.$transaction(
    async (tx) => {
      const detachedComplaints = await tx.complaint.updateMany({
        where: { bookingId: { not: null } },
        data: { bookingId: null },
      });
      const deletedBookings = await tx.booking.deleteMany();

      return {
        deletedBookings: deletedBookings.count,
        complaintsDetached: detachedComplaints.count,
      };
    },
    { timeout: 60000 },
  );

  await Promise.allSettled([deletePattern("customer:*"), deletePattern("garages:*")]);
  const cloudinary = await deleteCloudinaryAssets(asImageAssets(imageRecords));

  return {
    matched: {
      bookings: bookingCount,
      payments: paymentCount,
      reviews: reviewCount,
      broadcasts: broadcastCount,
      inspectionImages: imageRecords.length,
    },
    ...deletion,
    cloudinary,
  };
};

const deleteAllPayments = async () => {
  const result = await prisma.$transaction(async (tx) => {
    const [payments, customerWalletTransactions, garageWalletTransactions] =
      await Promise.all([
        tx.payment.deleteMany(),
        tx.walletTransaction.deleteMany(),
        tx.garageWalletTransaction.deleteMany(),
      ]);

    await Promise.all([
      tx.wallet.updateMany({ data: { balance: 0 } }),
      tx.garageWallet.updateMany({ data: { balance: 0 } }),
    ]);

    return {
      deletedPayments: payments.count,
      deletedCustomerWalletTransactions: customerWalletTransactions.count,
      deletedGarageWalletTransactions: garageWalletTransactions.count,
      resetWalletBalances: true,
    };
  });

  await Promise.allSettled([deletePattern("customer:*"), deletePattern("garages:*")]);
  return result;
};

const deleteAllGarages = async () => {
  const garages = await prisma.garage.findMany({
    select: { id: true },
  });
  const garageIds = garages.map((garage) => garage.id);
  const cloudinaryAssets = await collectGarageMedia(garageIds, {});

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.systemIssue.updateMany({
        where: { garageId: { not: null } },
        data: { garageId: null },
      });

      return deleteGaragesInTransaction(tx, garageIds, {});
    },
    { timeout: 60000 },
  );

  await Promise.allSettled([deletePattern("garages:*"), deletePattern("customer:*")]);
  const cloudinary = await deleteCloudinaryAssets(cloudinaryAssets);

  return {
    matchedGarages: garageIds.length,
    ...result,
    cloudinary,
  };
};

const deleteAllGarageApplications = async () => {
  const images = await prisma.garageApplicationImage.findMany({
    select: { publicId: true },
  });

  const deleted = await prisma.garageApplication.deleteMany();
  const cloudinary = await deleteCloudinaryAssets(asImageAssets(images));

  return {
    deletedApplications: deleted.count,
    cloudinary,
  };
};

const deleteAllServices = async () => {
  const [serviceMedia, categories] = await Promise.all([
    prisma.serviceMedia.findMany({ select: { publicId: true, mediaType: true } }),
    prisma.serviceCategory.findMany({ select: { thumbnailPublicId: true } }),
  ]);

  const cloudinaryAssets = [
    ...serviceMedia
      .map((media) => ({
        publicId: media.publicId,
        resourceType: media.mediaType === "VIDEO" ? "video" : "image",
      }))
      .filter((asset) => asset.publicId),
    ...categories
      .map((category) => category.thumbnailPublicId)
      .filter(Boolean)
      .map((publicId) => ({ publicId, resourceType: "image" })),
  ];

  const result = await prisma.$transaction(async (tx) => {
    const priceRanges = await tx.cityServicePriceRange.deleteMany();
    const garageServices = await tx.garageService.deleteMany();
    const bookingServices = await tx.bookingService.deleteMany();
    const categoriesDeleted = await tx.serviceCategory.deleteMany();

    return {
      deletedPriceRanges: priceRanges.count,
      deletedGarageServices: garageServices.count,
      deletedBookingServices: bookingServices.count,
      deletedServiceCategories: categoriesDeleted.count,
    };
  });

  await Promise.allSettled([
    deletePattern("services:*"),
    deletePattern("garages:*"),
    deletePattern("price-ranges:*"),
  ]);
  const cloudinary = await deleteCloudinaryAssets(cloudinaryAssets);

  return {
    ...result,
    cloudinary,
  };
};

const deleteAllVehicleMetadata = async () => {
  const deletedBrands = await prisma.vehicleBrand.deleteMany();

  await Promise.allSettled([deletePattern("vehicle-meta:*")]);

  return {
    deletedVehicleBrands: deletedBrands.count,
  };
};

const deleteAllCities = async () => {
  const deleted = await prisma.city.deleteMany();

  await Promise.allSettled([
    deletePattern("public:*"),
    deletePattern("cities:*"),
    deletePattern("services:*"),
    deletePattern("price-ranges:*"),
  ]);

  return {
    deletedCities: deleted.count,
  };
};

const deleteAllNotifications = async () => {
  const deleted = await prisma.notification.deleteMany();
  await Promise.allSettled([deletePattern("customer:*")]);

  return {
    deletedNotifications: deleted.count,
  };
};

const deleteAllSystemIssues = async () => {
  const deleted = await prisma.systemIssue.deleteMany();

  return {
    deletedSystemIssues: deleted.count,
  };
};

const resetServiceComingSoon = async () => {
  const result = await prisma.service.updateMany({
    data: { isComingSoon: false },
  });

  await Promise.allSettled([deletePattern("services:*")]);

  return {
    updatedServices: result.count,
  };
};

const nukeUsers = async () => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, phone: true },
  });
  const userIds = users.map((user) => user.id);
  const emails = unique(users.map((user) => normalizeEmail(user.email)));
  const phones = unique(users.map((user) => normalizeString(user.phone)));
  const cloudinaryAssets = await collectUserMedia(userIds);

  const result = await prisma.$transaction(
    async (tx) => {
      if (emails.length) {
        await tx.emailOtp.deleteMany({ where: { email: { in: emails } } });
      }
      if (phones.length) {
        await tx.phoneOtp.deleteMany({ where: { phone: { in: phones } } });
      }

      const pendingSignupOR = buildPendingSignupOr({ emails, phones });
      if (pendingSignupOR.length) {
        await tx.pendingSignup.deleteMany({ where: { OR: pendingSignupOR } });
      }

      await Promise.all([
        tx.systemIssue.updateMany({
          where: { userId: { not: null } },
          data: { userId: null },
        }),
        tx.garage.updateMany({
          where: { ownerId: { not: null } },
          data: { ownerId: null },
        }),
      ]);

      const bookingIds = (
        await tx.booking.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        })
      ).map((booking) => booking.id);

      if (bookingIds.length) {
        await tx.complaint.updateMany({
          where: { bookingId: { in: bookingIds } },
          data: { bookingId: null },
        });
      }

      const deletedUsers = await tx.user.deleteMany();

      return {
        deletedUsers: deletedUsers.count,
        clearedGarageOwnerLinks: true,
        clearedSystemIssueUserLinks: true,
      };
    },
    { timeout: 60000 },
  );

  await Promise.allSettled([deletePattern("customer:*"), deletePattern("garages:*")]);
  const cloudinary = await deleteCloudinaryAssets(cloudinaryAssets);

  return {
    ...result,
    cloudinary,
  };
};

const nukePlatform = async () => {
  const cloudinaryAssets = await collectAllDbMedia();

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.complaint.updateMany({
        where: { bookingId: { not: null } },
        data: { bookingId: null },
      });

      const bookings = await tx.booking.deleteMany();
      const complaints = await tx.complaint.deleteMany();
      const notifications = await tx.notification.deleteMany();
      const pendingSignups = await tx.pendingSignup.deleteMany();
      const emailOtps = await tx.emailOtp.deleteMany();
      const phoneOtps = await tx.phoneOtp.deleteMany();
      const garageApplications = await tx.garageApplication.deleteMany();
      const garages = await tx.garage.deleteMany();
      const users = await tx.user.deleteMany();
      await tx.cityServicePriceRange.deleteMany();
      await tx.garageService.deleteMany();
      await tx.bookingService.deleteMany();
      const serviceCategories = await tx.serviceCategory.deleteMany();
      const vehicleBrands = await tx.vehicleBrand.deleteMany();
      const cities = await tx.city.deleteMany();
      const systemIssues = await tx.systemIssue.deleteMany();

      return {
        deletedBookings: bookings.count,
        deletedComplaints: complaints.count,
        deletedNotifications: notifications.count,
        deletedUsers: users.count,
        deletedGarageApplications: garageApplications.count,
        deletedGarages: garages.count,
        deletedServiceCategories: serviceCategories.count,
        deletedVehicleBrands: vehicleBrands.count,
        deletedCities: cities.count,
        deletedSystemIssues: systemIssues.count,
        deletedPendingSignups: pendingSignups.count,
        deletedEmailOtps: emailOtps.count,
        deletedPhoneOtps: phoneOtps.count,
      };
    },
    { timeout: 60000 },
  );

  await Promise.allSettled([
    deletePattern("customer:*"),
    deletePattern("garages:*"),
    deletePattern("public:*"),
    deletePattern("services:*"),
    deletePattern("cities:*"),
    deletePattern("vehicle-meta:*"),
    deletePattern("price-ranges:*"),
  ]);
  const cloudinary = await deleteCloudinaryAssets(cloudinaryAssets);

  return {
    ...result,
    cloudinary,
  };
};

const runCommand = async ({ command, confirmation, payload = {}, requestedById = null } = {}) => {
  const metadata = assertCommand(command);

  if (metadata.action === "download") {
    throw new ApiError(400, "Use the download endpoint for this command");
  }

  assertConfirmation({ command, confirmation });

  let result;

  if (command === "migrate-deploy") {
    const bin = process.platform === "win32" ? "npx.cmd" : "npx";
    result = await runFixedProcess(bin, ["prisma", "migrate", "deploy"]);
  } else if (command === "reset-service-coming-soon") {
    result = await resetServiceComingSoon();
  } else if (command === "delete-user-data") {
    result = await deleteUserData({ payload, requestedById });
  } else if (command === "delete-garage-data") {
    result = await deleteGarageData({ payload, requestedById });
  } else if (command === "delete-customer-active-bookings") {
    result = await deleteCustomerBookings({ payload, scope: "active" });
  } else if (command === "delete-customer-payments") {
    result = await deleteCustomerPayments({ payload });
  } else if (command === "delete-customer-service-history") {
    result = await deleteCustomerBookings({ payload, scope: "history" });
  } else if (command === "delete-all-bookings") {
    result = await deleteAllBookings();
  } else if (command === "delete-all-payments") {
    result = await deleteAllPayments();
  } else if (command === "delete-all-garages") {
    result = await deleteAllGarages();
  } else if (command === "delete-all-garage-applications") {
    result = await deleteAllGarageApplications();
  } else if (command === "delete-all-services") {
    result = await deleteAllServices();
  } else if (command === "delete-all-vehicle-metadata") {
    result = await deleteAllVehicleMetadata();
  } else if (command === "delete-all-cities") {
    result = await deleteAllCities();
  } else if (command === "delete-all-notifications") {
    result = await deleteAllNotifications();
  } else if (command === "delete-all-system-issues") {
    result = await deleteAllSystemIssues();
  } else if (command === "nuke-users") {
    result = await nukeUsers();
  } else if (command === "nuke-platform") {
    result = await nukePlatform();
  }

  console.warn("[admin-dangerous] command executed", {
    command,
    requestedById,
    at: new Date().toISOString(),
  });

  return {
    command,
    confirmation: getExpectedConfirmation(command),
    result,
  };
};

module.exports = {
  createSqliteBackupFile,
  getExpectedConfirmation,
  listCommands,
  runCommand,
};
