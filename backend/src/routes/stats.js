const express = require("express");
const { stats } = require("../services/institutionService");

const router = express.Router();

// GET /api/stats -> platform-wide counts for the admin dashboard
router.get("/", async (_req, res, next) => {
  try {
    res.json(await stats());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
