const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "../backups/rovauto-old.db");

const db = new Database(dbPath, {
  readonly: true,
});

console.log("\nSQLite database opened successfully.\n");

const tables = db
  .prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `)
  .all();

console.log(`Found ${tables.length} tables:\n`);

for (const table of tables) {
  const tableName = table.name;

  const count = db
    .prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`)
    .get();

  console.log(`${tableName}: ${count.count}`);
}

db.close();