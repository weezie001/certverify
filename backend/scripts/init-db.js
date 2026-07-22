// Create the database schema. Works against the local file or Turso (whatever the
// TURSO_*/DB_FILE env vars point to). Run:  npm run db:init
const fs = require("fs");
const path = require("path");
const { getClient } = require("../src/db");
const { config } = require("../src/config");

(async () => {
  const schemaPath = path.join(__dirname, "..", "..", "database", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await getClient().executeMultiple(sql);
  console.log(`Schema initialized on: ${config.db.url}`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
