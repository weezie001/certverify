// Local end-to-end: deploys a fresh contract and drives the FULL stack against it —
// the real backend hashing (backend/src/hash.js) and the real backend verification
// logic (backend/src/services/verifyService.js, recompute-and-compare) talking to a
// live deployed contract. MySQL is replaced by an injected in-memory row so no DB is
// needed. Run with:  npx hardhat run scripts/e2e-local.js
const hre = require("hardhat");
const { certHash } = require("../backend/src/hash");
const { verifyByHash, VERDICT } = require("../backend/src/services/verifyService");

const log = (m) => console.log("• " + m);
function assert(cond, msg) {
  if (!cond) throw new Error("FAILED: " + msg);
  console.log("  \x1b[32m✓\x1b[0m " + msg);
}

// Shape an off-chain "MySQL row" (as db.getCertificateRow would return) from details.
function rowFrom(d, hash) {
  return {
    cert_hash: hash,
    full_name: d.fullName,
    matric_number: d.matricNumber,
    degree_title: d.degreeTitle,
    department: d.department,
    grad_year: d.yearOfGraduation,
    institution_name: d.institutionName,
  };
}

async function main() {
  const [admin, futminna, unilag, outsider] = await hre.ethers.getSigners();

  const Factory = await hre.ethers.getContractFactory("CertificateRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();
  log(`Deployed CertificateRegistry at ${await registry.getAddress()}`);
  log(`Admin = ${admin.address}\n`);

  // A backend-style read function bound to THIS live contract (same shape as chain.readCertificate).
  const readCertificate = async (h) => {
    const r = await registry.verifyCertificate(h);
    return {
      isValid: r.isValid, issuer: r.issuer, institutionName: r.institutionName,
      issuedAt: Number(r.issuedAt), revoked: r.revoked, exists: r.exists,
    };
  };

  // 1. Admin registers two universities (multi-tenant, one platform).
  await (await registry.connect(admin).registerInstitution(futminna.address, "Federal University of Technology, Minna")).wait();
  await (await registry.connect(admin).registerInstitution(unilag.address, "University of Lagos")).wait();
  assert(true, "Admin registered FUT Minna and UNILAG on one platform");

  // The graduate's details — institutionName must match the registered name.
  const details = {
    fullName: "Hassan Blessing",
    matricNumber: "2021/1/81777CS",
    degreeTitle: "BTech Cyber Security",
    department: "Cyber Security Science",
    yearOfGraduation: "2025",
    institutionName: "Federal University of Technology, Minna",
  };
  const hash = certHash(details); // the EXACT function the backend uses
  log(`Backend computed cert hash: ${hash}`);

  // 2. SECURITY: an unregistered wallet cannot issue.
  let blocked = false;
  try { await (await registry.connect(outsider).issueCertificate(hash)).wait(); } catch { blocked = true; }
  assert(blocked, "Unregistered wallet was blocked from issuing");

  // 3. FUT Minna issues the certificate on-chain.
  await (await registry.connect(futminna).issueCertificate(hash)).wait();
  assert(true, "FUT Minna issued the certificate on-chain");

  // 4. Public verification (recompute-and-compare) against the live contract -> VALID,
  //    with the issuing university auto-detected from the hash alone.
  const v1 = await verifyByHash(hash, { readCertificate, getCertificateRow: async () => rowFrom(details, hash) });
  assert(v1.verdict === VERDICT.VALID, "Verification returns VALID");
  assert(v1.issuingUniversity === details.institutionName, `Issuing university auto-detected: "${v1.issuingUniversity}"`);

  // 5. TAMPER: change a stored detail off-chain -> recomputed hash != on-chain hash -> HASH_MISMATCH.
  const tampered = rowFrom({ ...details, degreeTitle: "BTech Computer Science" }, hash);
  const v2 = await verifyByHash(hash, { readCertificate, getCertificateRow: async () => tampered });
  assert(v2.verdict === VERDICT.HASH_MISMATCH, "Tampered off-chain details detected (HASH_MISMATCH) — not shown as valid");

  // 6. SECURITY: a different university cannot revoke FUT Minna's certificate.
  blocked = false;
  try { await (await registry.connect(unilag).revokeCertificate(hash)).wait(); } catch { blocked = true; }
  assert(blocked, "UNILAG was blocked from revoking FUT Minna's certificate");

  // 7. The issuing university revokes -> verification returns REVOKED.
  await (await registry.connect(futminna).revokeCertificate(hash)).wait();
  const v3 = await verifyByHash(hash, { readCertificate, getCertificateRow: async () => rowFrom(details, hash) });
  assert(v3.verdict === VERDICT.REVOKED, "After issuer revocation, verification returns REVOKED");

  // 8. An unknown certificate -> NOT_FOUND.
  const unknown = certHash({ ...details, fullName: "Someone Else" });
  const v4 = await verifyByHash(unknown, { readCertificate, getCertificateRow: async () => null });
  assert(v4.verdict === VERDICT.NOT_FOUND, "Unknown certificate returns NOT_FOUND");

  console.log("\n\x1b[32mAll end-to-end checks passed.\x1b[0m");
}

main().catch((err) => {
  console.error("\n\x1b[31m" + err.message + "\x1b[0m");
  process.exitCode = 1;
});
