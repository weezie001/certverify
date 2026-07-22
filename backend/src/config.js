require("dotenv").config();

const config = {
  port: Number(process.env.PORT || 4000),
  // Read-only RPC. The backend never holds a private key (non-custodial).
  rpcUrl: process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545",
  contractAddress: process.env.CONTRACT_ADDRESS || "",
  // libSQL: a local file by default; Turso (libsql:// + token) in production.
  db: {
    url: process.env.TURSO_DATABASE_URL || process.env.DB_FILE || "file:./certverify.db",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  },
};

module.exports = { config };
