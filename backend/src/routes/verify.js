const express = require("express");
const { verifyByHash } = require("../services/verifyService");
const db = require("../db");

const router = express.Router();

// Public, no-auth verification. One endpoint for ALL universities.
// GET /api/verify/:hash
router.get("/:hash", async (req, res, next) => {
  try {
    const result = await verifyByHash(req.params.hash);

    // Best-effort audit log; never let logging failure break the response.
    db.logVerification({
      certHash: result.hash,
      result: result.verdict,
      verifierIp: req.ip,
    }).catch(() => {});

    res.json(result);
  } catch (err) {
    // Malformed hash -> 400; anything else falls through to the error handler.
    if (/invalid SHA-256 hash|must be a string/.test(err.message)) {
      err.status = 400;
    }
    next(err);
  }
});

module.exports = router;
