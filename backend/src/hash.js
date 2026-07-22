const crypto = require("crypto");

// Canonical preimage — MUST stay identical to Solidity `sha256(bytes(preimage))`
// and to CLAUDE.md. Field order is part of the contract; never reorder.
//   fullName|matricNumber|degreeTitle|department|yearOfGraduation|institutionName
const FIELDS = [
  "fullName",
  "matricNumber",
  "degreeTitle",
  "department",
  "yearOfGraduation",
  "institutionName",
];

/** Build the canonical, deterministic preimage string from certificate details. */
function canonicalPreimage(details) {
  if (!details || typeof details !== "object") {
    throw new Error("certificate details object is required");
  }
  const missing = FIELDS.filter((f) => {
    const v = details[f];
    return v === undefined || v === null || String(v).length === 0;
  });
  if (missing.length) {
    throw new Error(`missing certificate fields: ${missing.join(", ")}`);
  }
  return FIELDS.map((f) => String(details[f])).join("|");
}

/** SHA-256 of the canonical preimage, as a 0x-prefixed 32-byte hex string. */
function certHash(details) {
  const preimage = canonicalPreimage(details);
  const digest = crypto.createHash("sha256").update(preimage, "utf8").digest("hex");
  return "0x" + digest;
}

/** Validate + normalize a submitted hash to lowercase 0x + 64 hex. Throws if malformed. */
function normalizeHash(h) {
  if (typeof h !== "string") throw new Error("hash must be a string");
  let v = h.trim().toLowerCase();
  if (!v.startsWith("0x")) v = "0x" + v;
  if (!/^0x[0-9a-f]{64}$/.test(v)) {
    throw new Error("invalid SHA-256 hash format (expected 0x + 64 hex chars)");
  }
  return v;
}

module.exports = { FIELDS, canonicalPreimage, certHash, normalizeHash };
