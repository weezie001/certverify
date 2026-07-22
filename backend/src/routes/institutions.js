const express = require("express");
const { saveInstitution, getInstitution, listInstitutions } = require("../services/institutionService");

const router = express.Router();

// GET /api/institutions  -> list all registered universities (with cert counts)
router.get("/", async (_req, res, next) => {
  try {
    res.json({ institutions: await listInstitutions() });
  } catch (err) {
    next(err);
  }
});

// POST /api/institutions  -> store metadata after admin registered it on-chain
router.post("/", async (req, res, next) => {
  try {
    const saved = await saveInstitution(req.body || {});
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// GET /api/institutions/:wallet
router.get("/:wallet", async (req, res, next) => {
  try {
    const inst = await getInstitution(req.params.wallet);
    if (!inst) return res.status(404).json({ error: "institution not found" });
    res.json(inst);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
