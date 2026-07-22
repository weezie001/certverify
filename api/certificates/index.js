// GET  /api/certificates?issuer=0x… — list certificates issued by an institution.
// POST /api/certificates — persist off-chain details after on-chain issuance.
const { persistCertificate, listByIssuer } = require("../../backend/src/services/certificateService");
const { applyCors } = require("../../backend/src/httpCors");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  try {
    if (req.method === "GET") {
      const issuer = req.query && req.query.issuer;
      if (!issuer) return res.status(400).json({ error: "issuer query is required" });
      return res.json({ certificates: await listByIssuer(issuer) });
    }
    if (req.method === "POST") {
      const { issuerWallet, details } = req.body || {};
      const result = await persistCertificate({ issuerWallet, details });
      return res.status(201).json(result);
    }
    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
