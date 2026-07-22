// GET /api/stats — platform-wide counts for the admin dashboard.
const { stats } = require("../../backend/src/services/institutionService");
const { applyCors } = require("../../backend/src/httpCors");

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  try {
    res.json(await stats());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
