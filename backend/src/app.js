const express = require("express");
const cors = require("cors");

const verifyRoutes = require("./routes/verify");
const certificateRoutes = require("./routes/certificates");
const institutionRoutes = require("./routes/institutions");
const statsRoutes = require("./routes/stats");

function createApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/verify", verifyRoutes);
  app.use("/api/certificates", certificateRoutes);
  app.use("/api/institutions", institutionRoutes);
  app.use("/api/stats", statsRoutes);

  // 404
  app.use((_req, res) => res.status(404).json({ error: "not found" }));

  // Centralized error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || "internal error" });
  });

  return app;
}

module.exports = { createApp };
