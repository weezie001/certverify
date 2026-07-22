// GET /api/verify/:hash  — public, no-auth, integrity-checked verification.
const { verifyByHash } = require("../../backend/src/services/verifyService");
const db = require("../../backend/src/db");
const { applyCors } = require("../../backend/src/httpCors");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  try {
    const result = await verifyByHash(req.query.hash);
    // Best-effort audit log; never block the response on it.
    db.logVerification({
      certHash: result.hash,
      result: result.verdict,
      verifierIp: (req.headers["x-forwarded-for"] || "").split(",")[0] || null,
    }).catch(() => {});
    res.status(200).json(result);
  } catch (err) {
    const status = /invalid SHA-256 hash|must be a string/.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
};
