const { certHash: computeCertHash, normalizeHash } = require("../hash");
const chain = require("../chain");
const db = require("../db");

const defaultDeps = {
  readCertificate: chain.readCertificate,
  getInstitutionByWallet: db.getInstitutionByWallet,
  insertCertificate: db.insertCertificate,
  listCertificatesByIssuer: db.listCertificatesByIssuer,
};

/**
 * Stateless: compute the canonical hash for a set of student details so the frontend
 * knows what to submit on-chain via MetaMask. Does not touch the DB or chain.
 */
function prepareHash(details) {
  const hash = computeCertHash(details);
  return { hash };
}

/**
 * Persist off-chain details AFTER the institution issued the cert on-chain via MetaMask.
 * Confirms the on-chain record before storing, so MySQL can never disagree with the chain.
 *
 * @param {object} input  { details, issuerWallet } where details has the 6 canonical fields
 * @param {object} deps   injectable for tests
 */
async function persistCertificate(input, deps = defaultDeps) {
  const { details, issuerWallet } = input;
  if (!issuerWallet) throw badRequest("issuerWallet is required");

  const institution = await deps.getInstitutionByWallet(issuerWallet);
  if (!institution) throw badRequest("issuing wallet is not a registered institution");

  // The institution name is authoritative from the registry; force it into the preimage
  // so the off-chain details always hash to the same value the institution committed.
  const fullDetails = { ...details, institutionName: institution.name };
  const hash = computeCertHash(fullDetails);

  // Confirm the on-chain record exists and was issued by this wallet.
  const onchain = await deps.readCertificate(hash);
  if (!onchain.exists) throw conflict("no matching certificate found on-chain; issue it first");
  if (onchain.issuer.toLowerCase() !== issuerWallet.toLowerCase()) {
    throw conflict("on-chain issuer does not match the submitting wallet");
  }

  await deps.insertCertificate({
    certHash: hash,
    fullName: fullDetails.fullName,
    matricNumber: fullDetails.matricNumber,
    degreeTitle: fullDetails.degreeTitle,
    department: fullDetails.department,
    gradYear: fullDetails.yearOfGraduation,
    institutionId: institution.id,
  });

  return { hash, institution: institution.name };
}

async function listByIssuer(wallet, deps = defaultDeps) {
  if (!wallet) throw badRequest("issuer wallet is required");
  return deps.listCertificatesByIssuer(wallet);
}

function badRequest(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}
function conflict(msg) {
  const e = new Error(msg);
  e.status = 409;
  return e;
}

module.exports = { prepareHash, persistCertificate, listByIssuer, defaultDeps };
