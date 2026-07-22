const express = require("express");
const { prepareHash, persistCertificate, listByIssuer } = require("../services/certificateService");

const router = express.Router();

// GET /api/certificates?issuer=0x…  -> list certificates issued by an institution
router.get("/", async (req, res, next) => {
  try {
    const issuer = req.query.issuer;
    if (!issuer) { const e = new Error("issuer query is required"); e.status = 400; throw e; }
    res.json({ certificates: await listByIssuer(issuer) });
  } catch (err) {
    next(err);
  }
});

// POST /api/certificates/hash  -> compute the canonical hash to submit on-chain (stateless)
router.post("/hash", (req, res, next) => {
  try {
    res.json(prepareHash(req.body || {}));
  } catch (err) {
    err.status = err.status || 400;
    next(err);
  }
});

// POST /api/certificates  -> persist off-chain details after on-chain issuance
// body: { issuerWallet, details: { fullName, matricNumber, degreeTitle, department, yearOfGraduation } }
router.post("/", async (req, res, next) => {
  try {
    const { issuerWallet, details } = req.body || {};
    const result = await persistCertificate({ issuerWallet, details });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
