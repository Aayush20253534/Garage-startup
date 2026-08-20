require("dotenv").config();

const path = require("path");
const Database = require("better-sqlite3");
const { Client } = require("pg");

const SQLITE_PATH = path.join(
  __dirname,
  "../backups/rovauto-old.db"
);

const SKIP_TABLES = new Set([
  "_prisma_migrations",
  "spatial_ref_sys",
]);

function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function convertValue(value, pgType) {
  if (value === null || value === undefined) {
    return null;
  }

  switch (pgType) {
    case "boolean":
      if (value === 1 || value === "1" || value === true) return true;
      if (value === 0 || value === "0" || value === false) return false;

      if (typeof value === "string") {
        if (value.toLowerCase() === "true") return true;
        if (value.toLowerCase() === "false") return false;
      }

      return Boolean(value);

    case "json":
case "jsonb":
  if (typeof value === "string") {
    try {
      // Already valid JSON
      return JSON.stringify(JSON.parse(value));
    } catch {
      // Plain SQLite string → store as JSON string
      return JSON.stringify(value);
    }
  }

  return JSON.stringify(value);

    case "bytea":
      if (Buffer.isBuffer(value)) return value;
      return Buffer.from(value);

    default:
      return value;
  }
}

function getSQLiteTables(sqlite) {
  return sqlite
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    .all()
    .map((row) => row.name);
}

function getSQLiteColumns(sqlite, tableName) {
  return sqlite
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all()
    .map((column) => column.name);
}
async function getPostgresForeignKeys(client) {
  const result = await client.query(`
    SELECT
      tc.table_name AS child_table,
      ccu.table_name AS parent_table,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
      AND tc.constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
  `);

  return result.rows;
}

async function topologicalSort(client, tables) {
  const tableSet = new Set(tables);

  const foreignKeys = await getPostgresForeignKeys(client);

  const dependencies = new Map();

  for (const table of tables) {
    dependencies.set(table, new Set());
  }

  for (const fk of foreignKeys) {
    const child = fk.child_table;
    const parent = fk.parent_table;

    if (
      tableSet.has(child) &&
      tableSet.has(parent) &&
      child !== parent
    ) {
      dependencies.get(child).add(parent);
    }
  }

  console.log("\nDetected PostgreSQL dependencies:\n");

  for (const [table, deps] of dependencies.entries()) {
    if (deps.size > 0) {
      console.log(
        `   ${table} → ${[...deps].join(", ")}`
      );
    }
  }

  const sorted = [];
  const remaining = new Set(tables);

  while (remaining.size > 0) {
    let progress = false;

    for (const table of [...remaining]) {
      const deps = dependencies.get(table) || new Set();

      const unresolved = [...deps].filter((dependency) =>
        remaining.has(dependency)
      );

      if (unresolved.length === 0) {
        sorted.push(table);
        remaining.delete(table);
        progress = true;
      }
    }

    if (!progress) {
      console.warn(
        "\n⚠ Circular foreign-key dependency detected:"
      );

      for (const table of remaining) {
        const unresolved = [
          ...(dependencies.get(table) || []),
        ].filter((dependency) => remaining.has(dependency));

        console.warn(
          `   ${table} → ${unresolved.join(", ")}`
        );
      }

      /*
       * We stop here instead of guessing.
       * Guessing FK order during a DB migration is how
       * perfectly respectable evenings get destroyed.
       */
      throw new Error(
        "Circular foreign-key dependencies detected. Migration stopped."
      );
    }
  }

  return sorted;
}

async function getPostgresTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `);

  return new Set(result.rows.map((row) => row.table_name));
}

async function getPostgresColumns(client, tableName) {
  const result = await client.query(
    `
      SELECT
        column_name,
        data_type,
        udt_name,
        is_generated,
        identity_generation,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  const columns = new Map();

  for (const row of result.rows) {
    columns.set(row.column_name, {
      type: row.data_type,
      udtName: row.udt_name,
      generated: row.is_generated,
      identityGeneration: row.identity_generation,
      default: row.column_default,
    });
  }

  return columns;
}

async function resetSequences(client, tableName, postgresColumns) {
  for (const [columnName, columnInfo] of postgresColumns.entries()) {
    const hasSequence =
      columnInfo.default &&
      columnInfo.default.includes("nextval(");

    if (!hasSequence) continue;

    const sequenceResult = await client.query(
      `SELECT pg_get_serial_sequence($1, $2) AS sequence_name`,
      [tableName, columnName]
    );

    const sequenceName = sequenceResult.rows[0]?.sequence_name;

    if (!sequenceName) continue;

    const maxResult = await client.query(
      `
        SELECT MAX(${quoteIdentifier(columnName)}) AS max_value
        FROM ${quoteIdentifier(tableName)}
      `
    );

    const maxValue = maxResult.rows[0]?.max_value;

    if (maxValue === null || maxValue === undefined) {
      continue;
    }

    await client.query(
      `SELECT setval($1::regclass, $2, true)`,
      [sequenceName, maxValue]
    );

    console.log(
      `   ↳ sequence reset: ${columnName} → ${maxValue}`
    );
  }
}

async function importTable({
  sqlite,
  pg,
  tableName,
}) {
  const sqliteColumns = getSQLiteColumns(sqlite, tableName);

  const postgresColumns = await getPostgresColumns(pg, tableName);

  const usableColumns = sqliteColumns.filter((column) => {
    const target = postgresColumns.get(column);

    if (!target) return false;

    // PostgreSQL generated columns must not be inserted manually.
    if (
      target.generated &&
      target.generated !== "NEVER"
    ) {
      return false;
    }

    return true;
  });

  if (usableColumns.length === 0) {
    console.log(`⚠ ${tableName}: no matching columns`);
    return;
  }

  const rows = sqlite
    .prepare(`SELECT * FROM ${quoteIdentifier(tableName)}`)
    .all();

  if (rows.length === 0) {
    console.log(`○ ${tableName}: empty`);
    return;
  }

  console.log(
    `\n→ ${tableName}: importing ${rows.length} row(s)`
  );

  await pg.query("BEGIN");

  try {
    let imported = 0;

    /*
     * Batch size is calculated so we stay well below PostgreSQL's
     * parameter limit.
     */
    const batchSize = Math.max(
      1,
      Math.min(
        250,
        Math.floor(50000 / usableColumns.length)
      )
    );

    for (
      let offset = 0;
      offset < rows.length;
      offset += batchSize
    ) {
      const batch = rows.slice(offset, offset + batchSize);

      const values = [];
      const placeholders = [];

      for (const row of batch) {
        const rowPlaceholders = [];

        for (const column of usableColumns) {
          const columnInfo = postgresColumns.get(column);

          let pgType = columnInfo.type;

          if (pgType === "USER-DEFINED") {
            pgType = columnInfo.udtName;
          }

          const converted = convertValue(
            row[column],
            pgType
          );

          values.push(converted);
          rowPlaceholders.push(`$${values.length}`);
        }

        placeholders.push(
          `(${rowPlaceholders.join(", ")})`
        );
      }

      const columnSql = usableColumns
        .map(quoteIdentifier)
        .join(", ");

      const sql = `
        INSERT INTO ${quoteIdentifier(tableName)}
          (${columnSql})
        VALUES
          ${placeholders.join(", ")}
        ON CONFLICT DO NOTHING
      `;

      const result = await pg.query(sql, values);

      imported += result.rowCount;

      process.stdout.write(
        `\r   ${Math.min(
          offset + batch.length,
          rows.length
        )}/${rows.length}`
      );
    }

    await pg.query("COMMIT");

    console.log(
      `\n✓ ${tableName}: ${imported} inserted`
    );

    await resetSequences(
      pg,
      tableName,
      postgresColumns
    );
  } catch (error) {
    await pg.query("ROLLBACK");

    console.error(`\n\n❌ Failed at table: ${tableName}`);
    console.error(error.message);

    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from .env"
    );
  }

  console.log("\n======================================");
  console.log(" SQLite → Neon PostgreSQL Migration");
  console.log("======================================\n");

  console.log("SQLite:");
  console.log(SQLITE_PATH);

  const sqlite = new Database(SQLITE_PATH, {
    readonly: true,
  });

  const pg = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log("\nConnecting to Neon...");
    await pg.connect();

    const dbInfo = await pg.query(`
      SELECT
        current_database() AS database,
        current_user AS user
    `);

    console.log(
      `Connected to PostgreSQL database: ${dbInfo.rows[0].database}`
    );

    const sqliteTables = getSQLiteTables(sqlite);
    const postgresTables = await getPostgresTables(pg);

    let migrationTables = sqliteTables.filter(
      (table) =>
        !SKIP_TABLES.has(table) &&
        postgresTables.has(table)
    );

    const skipped = sqliteTables.filter(
      (table) =>
        SKIP_TABLES.has(table) ||
        !postgresTables.has(table)
    );

    console.log(
      `\nSQLite tables: ${sqliteTables.length}`
    );

    console.log(
      `Tables eligible for import: ${migrationTables.length}`
    );

    console.log("\nSkipped tables:");

    for (const table of skipped) {
      if (SKIP_TABLES.has(table)) {
        console.log(`   ${table} [intentionally skipped]`);
      } else {
        console.log(
          `   ${table} [not present in Neon]`
        );
      }
    }

   migrationTables = await topologicalSort(
  pg,
  migrationTables
);

    console.log("\nImport order:\n");

    migrationTables.forEach((table, index) => {
      console.log(`${index + 1}. ${table}`);
    });

    console.log("\nStarting import...\n");

    for (const tableName of migrationTables) {
      await importTable({
        sqlite,
        pg,
        tableName,
      });
    }

    console.log("\n======================================");
    console.log(" Import completed");
    console.log("======================================\n");

    console.log(
      "Now run the verification script before using this DB in production."
    );
  } finally {
    sqlite.close();

    try {
      await pg.end();
    } catch {}
  }
}

main().catch((error) => {
  console.error("\nMigration stopped.");
  console.error(error);

  process.exit(1);
});