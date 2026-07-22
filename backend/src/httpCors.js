// Minimal CORS for the serverless functions. Same-origin calls don't need it, but this
// lets a separately-hosted frontend (or local dev) reach the deployed API.
// Returns true if the request was a preflight that has been fully handled.
function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { applyCors };
