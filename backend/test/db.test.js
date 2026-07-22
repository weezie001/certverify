const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// Use an isolated temp file DB (set before requiring config/db).
const TMP = path.join(__dirname, ".tmp-db-test.db");
process.env.TURSO_DATABASE_URL = "";
process.env.DB_FILE = "file:" + TMP;

const db = require("../src/db");

function cleanup() {
  for (const f of [TMP, TMP + "-wal", TMP + "-shm"]) {
    try { fs.unlinkSync(f); } catch {}
  }
}

before(async () => {
  cleanup();
  const schema = fs.readFileSync(path.join(__dirname, "..", "..", "database", "schema.sql"), "utf8");
  await db.getClient().executeMultiple(schema);
});
after(cleanup);

test("upsertInstitution inserts, then updates the same row", async () => {
  const a = await db.upsertInstitution({ wallet: "0xabc", name: "FUT Minna", contactEmail: "a@futminna.edu" });
  assert.equal(a.name, "FUT Minna");
  const b = await db.upsertInstitution({ wallet: "0xabc", name: "FUT Minna", contactPhone: "08012345678" });
  assert.equal(Number(b.id), Number(a.id)); // same row, not a duplicate
  assert.equal(b.contact_phone, "08012345678");
});

test("insertCertificate + getCertificateRow joins the institution name", async () => {
  const inst = await db.getInstitutionByWallet("0xabc");
  await db.insertCertificate({
    certHash: "0xhash1", fullName: "Ada Obi", matricNumber: "M1",
    degreeTitle: "BSc Computer Science", department: "Computer Science",
    gradYear: "2024", institutionId: inst.id,
  });
  const row = await db.getCertificateRow("0xhash1");
  assert.equal(row.full_name, "Ada Obi");
  assert.equal(row.institution_name, "FUT Minna"); // joined from institutions
});

test("getCertificateRow returns null for an unknown hash", async () => {
  assert.equal(await db.getCertificateRow("0xunknown"), null);
});

test("logVerification writes an audit row", async () => {
  await db.logVerification({ certHash: "0xhash1", result: "valid", verifierIp: "127.0.0.1" });
  const r = await db.getClient().execute("SELECT COUNT(*) AS n FROM verification_logs");
  assert.equal(Number(r.rows[0].n), 1);
});
