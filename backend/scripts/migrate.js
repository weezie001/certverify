// Idempotent migration: add the newer institution columns to an existing database.
// Safe to run repeatedly — "duplicate column" errors are ignored. Run:  node scripts/migrate.js
const { getClient } = require("../src/db");
const { config } = require("../src/config");

const ADD_COLUMNS = [
  "ALTER TABLE institutions ADD COLUMN abbreviation TEXT",
  "ALTER TABLE institutions ADD COLUMN website TEXT",
  "ALTER TABLE institutions ADD COLUMN country TEXT",
  "ALTER TABLE institutions ADD COLUMN city TEXT",
  "ALTER TABLE institutions ADD COLUMN accreditation_no TEXT",
];

(async () => {
  const c = getClient();
  for (const sql of ADD_COLUMNS) {
    try {
      await c.execute(sql);
      console.log("applied:", sql);
    } catch (e) {
      if (/duplicate column/i.test(e.message)) console.log("skip (exists):", sql);
      else throw e;
    }
  }
  console.log("Migration complete on:", config.db.url);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
