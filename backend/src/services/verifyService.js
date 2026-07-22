const { certHash: computeCertHash, normalizeHash } = require("../hash");
const chain = require("../chain");
const db = require("../db");

// Possible verdicts. These line up with the verification_logs.result ENUM.
const VERDICT = {
  VALID: "valid",
  REVOKED: "revoked",
  NOT_FOUND: "not_found",
  HASH_MISMATCH: "hash_mismatch",
  INVALID: "invalid",
};

const defaultDeps = {
  readCertificate: chain.readCertificate,
  getCertificateRow: db.getCertificateRow,
};

/**
 * Integrity-checked verification. This is the core requirement: do NOT just look up a
 * record and display it. Recompute the SHA-256 from the stored off-chain details and
 * require it to equal the on-chain hash AND the cert to be un-revoked.
 *
 * @param {string} submittedHash  the certificate hash/code the verifier pasted in
 * @param {object} deps           { readCertificate, getCertificateRow } (injectable for tests)
 */
async function verifyByHash(submittedHash, deps = defaultDeps) {
  const hash = normalizeHash(submittedHash); // throws on malformed input -> 400 at the route

  // 1. On-chain status. Auto-identifies the issuing university from the hash alone.
  const onchain = await deps.readCertificate(hash);
  if (!onchain.exists) {
    return { verdict: VERDICT.NOT_FOUND, isValid: false, hash };
  }

  // 2. Off-chain details needed to (a) recompute and (b) display.
  const row = await deps.getCertificateRow(hash);
  if (!row) {
    // On-chain record exists but we have no off-chain details to attest — cannot verify.
    return {
      verdict: VERDICT.NOT_FOUND,
      isValid: false,
      hash,
      note: "on-chain record exists but no off-chain details are stored",
    };
  }

  // 3. RECOMPUTE from stored details and compare to the on-chain key. This detects any
  //    tampering with the off-chain database (e.g. a changed grade or name).
  const recomputed = computeCertHash({
    fullName: row.full_name,
    matricNumber: row.matric_number,
    degreeTitle: row.degree_title,
    department: row.department,
    yearOfGraduation: row.grad_year,
    institutionName: row.institution_name,
  });
  if (recomputed.toLowerCase() !== hash.toLowerCase()) {
    return { verdict: VERDICT.HASH_MISMATCH, isValid: false, hash };
  }

  // 4. Revocation check (record stays on-chain forever; only its status changes).
  if (onchain.revoked) {
    return {
      verdict: VERDICT.REVOKED,
      isValid: false,
      hash,
      issuingUniversity: onchain.institutionName,
      issuedAt: onchain.issuedAt,
    };
  }

  // 5. Valid: hash matches AND not revoked. Safe to display details + issuing university.
  return {
    verdict: VERDICT.VALID,
    isValid: true,
    hash,
    issuingUniversity: onchain.institutionName,
    issuerWallet: onchain.issuer,
    issuedAt: onchain.issuedAt,
    certificate: {
      fullName: row.full_name,
      matricNumber: row.matric_number,
      degreeTitle: row.degree_title,
      department: row.department,
      yearOfGraduation: row.grad_year,
    },
  };
}

module.exports = { VERDICT, verifyByHash, defaultDeps };
