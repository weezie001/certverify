// GET  /api/institutions — list all registered universities (with cert counts).
// POST /api/institutions — store metadata after on-chain registration.
const { saveInstitution, listInstitutions } = require("../../backend/src/services/institutionService");
const { applyCors } = require("../../backend/src/httpCors");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  try {
    if (req.method === "GET") {
      return res.json({ institutions: await listInstitutions() });
    }
    if (req.method === "POST") {
      const saved = await saveInstitution(req.body || {});
      return res.status(201).json(saved);
    }
    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
