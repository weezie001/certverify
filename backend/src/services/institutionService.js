const chain = require("../chain");
const db = require("../db");

const defaultDeps = {
  readInstitution: chain.readInstitution,
  upsertInstitution: db.upsertInstitution,
  getInstitutionByWallet: db.getInstitutionByWallet,
  listInstitutions: db.listInstitutions,
  getStats: db.getStats,
};

/**
 * Persist an institution's off-chain contact metadata AFTER the admin registered it
 * on-chain via MetaMask. We confirm the on-chain registration first so the off-chain
 * record can only mirror an authorized institution.
 */
async function saveInstitution(input, deps = defaultDeps) {
  const {
    wallet,
    abbreviation = null,
    website = null,
    country = null,
    city = null,
    accreditationNo = null,
    contactEmail = null,
    contactPhone = null,
  } = input;
  if (!wallet) {
    const e = new Error("wallet is required");
    e.status = 400;
    throw e;
  }

  const onchain = await deps.readInstitution(wallet);
  if (!onchain.registered) {
    const e = new Error("wallet is not registered on-chain; admin must register it first");
    e.status = 409;
    throw e;
  }

  // Name is authoritative from the on-chain registry, not client input.
  return deps.upsertInstitution({
    wallet,
    name: onchain.name,
    abbreviation,
    website,
    country,
    city,
    accreditationNo,
    contactEmail,
    contactPhone,
  });
}

async function getInstitution(wallet, deps = defaultDeps) {
  return deps.getInstitutionByWallet(wallet);
}

async function listInstitutions(deps = defaultDeps) {
  return deps.listInstitutions();
}

async function stats(deps = defaultDeps) {
  return deps.getStats();
}

module.exports = { saveInstitution, getInstitution, listInstitutions, stats, defaultDeps };
