// Runtime config. Contract address + API base are stored in localStorage so the app
// works before deployment and can be pointed at a local Hardhat node or Sepolia.
// Edit defaults here, or use the "Network settings" panel in the UI.

const DEFAULT_CONTRACT = "0xd017c0F939BeC9FbF622351ed2C56bD311aF4f00"; // Sepolia deployment

export function getApiBase() {
  const remote = location.hostname !== "localhost" && location.hostname !== "127.0.0.1";
  const saved = localStorage.getItem("certverify.apiBase");
  // Use a saved base, BUT ignore a stale localhost value when we're served from a real
  // domain — otherwise the deployed (HTTPS) site tries http://localhost and the browser
  // blocks it as mixed content ("Failed to fetch").
  if (saved && !(remote && /localhost|127\.0\.0\.1/i.test(saved))) return saved;
  // Default: same-origin /api in production (Vercel); local Express backend in dev.
  return remote ? "" : "http://localhost:4000";
}
export function setApiBase(v) {
  localStorage.setItem("certverify.apiBase", v.trim());
}
export function getContractAddress() {
  return localStorage.getItem("certverify.contractAddress") || DEFAULT_CONTRACT;
}
export function setContractAddress(v) {
  localStorage.setItem("certverify.contractAddress", v.trim());
}

// WalletConnect / Reown project ID — enables the mobile / QR-code login option.
// PASTE YOUR PROJECT ID HERE (free at cloud.reown.com) to turn mobile login on for
// everyone. It is a PUBLIC client identifier, safe to ship in the frontend.
const DEFAULT_WC_PROJECT_ID = "01e152ef04a73471181bcf63b4429251";

export function getWalletConnectProjectId() {
  // Hidden escape hatch (the settings panel is gone): visiting any page with
  // ?wc=<project-id> stores it for this browser.
  const fromUrl = new URLSearchParams(location.search).get("wc");
  if (fromUrl) localStorage.setItem("certverify.wcProjectId", fromUrl.trim());
  return localStorage.getItem("certverify.wcProjectId") || DEFAULT_WC_PROJECT_ID;
}
export function setWalletConnectProjectId(v) {
  localStorage.setItem("certverify.wcProjectId", v.trim());
}

// Human-readable ABI (ethers v6) — only the functions the frontend calls.
export const ABI = [
  "function admin() view returns (address)",
  "function institutions(address) view returns (string name, bool registered)",
  "function registerInstitution(address wallet, string name)",
  "function issueCertificate(bytes32 certHash)",
  "function revokeCertificate(bytes32 certHash)",
  "function verifyCertificate(bytes32 certHash) view returns (bool isValid, address issuer, string institutionName, uint256 issuedAt, bool revoked, bool exists)",
  // Custom errors — needed so ethers can decode reverts into readable names.
  "error NotAdmin()",
  "error NotRegisteredInstitution()",
  "error AlreadyRegistered()",
  "error EmptyName()",
  "error ZeroAddress()",
  "error InvalidHash()",
  "error CertificateExists()",
  "error CertificateNotFound()",
  "error NotIssuer()",
  "error AlreadyRevoked()",
];
