// GET /api/institutions/:wallet — fetch institution metadata.
const { getInstitution } = require("../../backend/src/services/institutionService");
const { applyCors } = require("../../backend/src/httpCors");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  try {
    const inst = await getInstitution(req.query.wallet);
    if (!inst) return res.status(404).json({ error: "institution not found" });
    res.status(200).json(inst);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
