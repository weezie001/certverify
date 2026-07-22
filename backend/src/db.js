// libSQL data layer. Same code works two ways:
//   • local dev  -> url "file:./certverify.db"  (zero setup, a local file)
//   • production -> Turso (url "libsql://…" + authToken), serverless-friendly (Vercel)
const { createClient } = require("@libsql/client");
const { config } = require("./config");

let client;
function getClient() {
  if (!client) client = createClient(config.db);
  return client;
}

// Columns selected for a full institution record (kept in one place).
const INST_COLS =
  "id, wallet, name, abbreviation, website, country, city, accreditation_no, contact_email, contact_phone, created_at";

async function getInstitutionByWallet(wallet) {
  const r = await getClient().execute({
    sql: `SELECT ${INST_COLS} FROM institutions WHERE wallet = ? LIMIT 1`,
    args: [wallet],
  });
  return r.rows[0] || null;
}

async function upsertInstitution({
  wallet,
  name,
  abbreviation = null,
  website = null,
  country = null,
  city = null,
  accreditationNo = null,
  contactEmail = null,
  contactPhone = null,
}) {
  await getClient().execute({
    sql: `INSERT INTO institutions
            (wallet, name, abbreviation, website, country, city, accreditation_no, contact_email, contact_phone)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(wallet) DO UPDATE SET
            name = excluded.name,
            abbreviation = excluded.abbreviation,
            website = excluded.website,
            country = excluded.country,
            city = excluded.city,
            accreditation_no = excluded.accreditation_no,
            contact_email = excluded.contact_email,
            contact_phone = excluded.contact_phone`,
    args: [wallet, name, abbreviation, website, country, city, accreditationNo, contactEmail, contactPhone],
  });
  return getInstitutionByWallet(wallet);
}

/** All registered institutions, newest first, with a count of certificates each issued. */
async function listInstitutions() {
  const r = await getClient().execute(
    `SELECT ${INST_COLS.split(", ").map((c) => "i." + c).join(", ")},
            (SELECT COUNT(*) FROM certificates c WHERE c.institution_id = i.id) AS cert_count
     FROM institutions i
     ORDER BY i.created_at DESC, i.id DESC`
  );
  return r.rows;
}

/** Platform-wide counts for the admin dashboard. */
async function getStats() {
  const c = getClient();
  const [inst, cert, ver] = await Promise.all([
    c.execute("SELECT COUNT(*) AS n FROM institutions"),
    c.execute("SELECT COUNT(*) AS n FROM certificates"),
    c.execute("SELECT COUNT(*) AS n FROM verification_logs"),
  ]);
  return {
    institutions: Number(inst.rows[0].n),
    certificates: Number(cert.rows[0].n),
    verifications: Number(ver.rows[0].n),
  };
}

/** All certificates issued by a given institution wallet, newest first. */
async function listCertificatesByIssuer(wallet) {
  const r = await getClient().execute({
    sql: `SELECT c.cert_hash, c.full_name, c.matric_number, c.degree_title, c.department,
                 c.grad_year, c.issued_at
          FROM certificates c
          JOIN institutions i ON c.institution_id = i.id
          WHERE i.wallet = ?
          ORDER BY c.issued_at DESC, c.id DESC`,
    args: [wallet],
  });
  return r.rows;
}

/** Off-chain certificate details joined with the issuing institution's name. */
async function getCertificateRow(certHash) {
  const r = await getClient().execute({
    sql: `SELECT c.cert_hash, c.full_name, c.matric_number, c.degree_title, c.department,
                 c.grad_year, c.issued_at, i.name AS institution_name, i.wallet AS institution_wallet
          FROM certificates c
          JOIN institutions i ON c.institution_id = i.id
          WHERE c.cert_hash = ? LIMIT 1`,
    args: [certHash],
  });
  return r.rows[0] || null;
}

async function insertCertificate({ certHash, fullName, matricNumber, degreeTitle, department, gradYear, institutionId }) {
  await getClient().execute({
    sql: `INSERT INTO certificates
            (cert_hash, full_name, matric_number, degree_title, department, grad_year, institution_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [certHash, fullName, matricNumber, degreeTitle, department, gradYear, institutionId],
  });
}

async function logVerification({ certHash, result, verifierIp = null }) {
  await getClient().execute({
    sql: "INSERT INTO verification_logs (cert_hash, result, verifier_ip) VALUES (?, ?, ?)",
    args: [certHash, result, verifierIp],
  });
}

module.exports = {
  getClient,
  getInstitutionByWallet,
  upsertInstitution,
  listInstitutions,
  getStats,
  listCertificatesByIssuer,
  getCertificateRow,
  insertCertificate,
  logVerification,
};
