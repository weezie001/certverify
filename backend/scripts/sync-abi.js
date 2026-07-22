// Copies the compiled ABI from the Hardhat artifact into backend/abi so the backend
// stays in sync with the contract. Run after `npx hardhat compile` at the repo root.
//   node backend/scripts/sync-abi.js
const fs = require("fs");
const path = require("path");

const artifact = path.join(
  __dirname,
  "..",
  "..",
  "artifacts",
  "contracts",
  "CertificateRegistry.sol",
  "CertificateRegistry.json"
);
const out = path.join(__dirname, "..", "abi", "CertificateRegistry.json");

const { abi } = JSON.parse(fs.readFileSync(artifact, "utf8"));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(abi, null, 2) + "\n");
console.log(`Wrote ${abi.length} ABI entries to ${out}`);
