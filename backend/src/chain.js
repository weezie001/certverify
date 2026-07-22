const { ethers } = require("ethers");
const { config } = require("./config");

// ABI copied from the Hardhat artifact (see scripts/sync-abi). require() keeps it
// reliably bundled by serverless tracers (Vercel). Read-only here.
const abi = require("../abi/CertificateRegistry.json");

let provider;
function getProvider() {
  if (!provider) provider = new ethers.JsonRpcProvider(config.rpcUrl);
  return provider;
}

/** Read-only contract instance. No signer — the backend never sends transactions. */
function getReadContract() {
  if (!config.contractAddress) {
    throw new Error("CONTRACT_ADDRESS is not set; cannot reach the registry");
  }
  return new ethers.Contract(config.contractAddress, abi, getProvider());
}

/** Read on-chain status for a certificate hash. Auto-identifies the issuing university. */
async function readCertificate(certHash) {
  const c = getReadContract();
  const r = await c.verifyCertificate(certHash);
  return {
    isValid: r.isValid,
    issuer: r.issuer,
    institutionName: r.institutionName,
    issuedAt: Number(r.issuedAt),
    revoked: r.revoked,
    exists: r.exists,
  };
}

/** Read on-chain institution record for a wallet. */
async function readInstitution(wallet) {
  const c = getReadContract();
  const r = await c.institutions(wallet);
  return { name: r.name, registered: r.registered };
}

module.exports = { getProvider, getReadContract, readCertificate, readInstitution };
