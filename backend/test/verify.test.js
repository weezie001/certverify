const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyByHash, VERDICT } = require("../src/services/verifyService");
const { certHash } = require("../src/hash");

// A genuine certificate and its true hash (what the institution committed on-chain).
const DETAILS = {
  fullName: "Ada Obi",
  matricNumber: "190401001",
  degreeTitle: "BSc Computer Science",
  department: "Computer Science",
  yearOfGraduation: "2024",
  institutionName: "University of Lagos",
};
const HASH = certHash(DETAILS);

// An off-chain DB row that matches DETAILS exactly (column-name shape from db.getCertificateRow).
const goodRow = {
  cert_hash: HASH,
  full_name: DETAILS.fullName,
  matric_number: DETAILS.matricNumber,
  degree_title: DETAILS.degreeTitle,
  department: DETAILS.department,
  grad_year: DETAILS.yearOfGraduation,
  institution_name: DETAILS.institutionName,
  institution_wallet: "0xUNILAG",
};

function deps({ onchain, row }) {
  return {
    readCertificate: async () => onchain,
    getCertificateRow: async () => row,
  };
}

test("VALID: on-chain exists, not revoked, recomputed hash matches", async () => {
  const res = await verifyByHash(HASH, deps({
    onchain: { exists: true, revoked: false, issuer: "0xUNILAG", institutionName: "University of Lagos", issuedAt: 1700000000 },
    row: goodRow,
  }));
  assert.equal(res.verdict, VERDICT.VALID);
  assert.equal(res.isValid, true);
  assert.equal(res.issuingUniversity, "University of Lagos"); // auto-identified
  assert.equal(res.certificate.fullName, "Ada Obi");
});

test("NOT_FOUND: no on-chain record for the hash", async () => {
  const res = await verifyByHash(HASH, deps({
    onchain: { exists: false, revoked: false, issuer: "0x0", institutionName: "", issuedAt: 0 },
    row: null,
  }));
  assert.equal(res.verdict, VERDICT.NOT_FOUND);
  assert.equal(res.isValid, false);
});

test("HASH_MISMATCH: off-chain details were tampered with (recompute != on-chain hash)", async () => {
  const tamperedRow = { ...goodRow, degree_title: "First Class MBBS" }; // grade/degree changed in MySQL
  const res = await verifyByHash(HASH, deps({
    onchain: { exists: true, revoked: false, issuer: "0xUNILAG", institutionName: "University of Lagos", issuedAt: 1700000000 },
    row: tamperedRow,
  }));
  assert.equal(res.verdict, VERDICT.HASH_MISMATCH);
  assert.equal(res.isValid, false);
});

test("REVOKED: hash matches but the cert was revoked on-chain", async () => {
  const res = await verifyByHash(HASH, deps({
    onchain: { exists: true, revoked: true, issuer: "0xUNILAG", institutionName: "University of Lagos", issuedAt: 1700000000 },
    row: goodRow,
  }));
  assert.equal(res.verdict, VERDICT.REVOKED);
  assert.equal(res.isValid, false);
  assert.equal(res.issuingUniversity, "University of Lagos");
});

test("NOT_FOUND note: on-chain exists but no off-chain details stored", async () => {
  const res = await verifyByHash(HASH, deps({
    onchain: { exists: true, revoked: false, issuer: "0xUNILAG", institutionName: "University of Lagos", issuedAt: 1700000000 },
    row: null,
  }));
  assert.equal(res.verdict, VERDICT.NOT_FOUND);
  assert.match(res.note, /no off-chain details/);
});

test("malformed hash is rejected before any lookup", async () => {
  await assert.rejects(() => verifyByHash("not-a-hash", deps({ onchain: {}, row: null })), /invalid SHA-256 hash/);
});
