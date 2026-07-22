// POST /api/certificates/hash — compute the canonical hash (stateless).
const { prepareHash } = require("../../backend/src/services/certificateService");
const { applyCors } = require("../../backend/src/httpCors");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  try {
    res.status(200).json(prepareHash(req.body || {}));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
};
