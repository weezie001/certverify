// GET /api/health — liveness check.
module.exports = (req, res) => res.status(200).json({ ok: true });
