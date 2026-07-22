-- Off-chain database schema (libSQL / SQLite dialect — works locally as a file and on Turso).
-- Holds ONLY non-tamper-critical / personal data. The blockchain remains the source of
-- truth for hash, issuer, timestamp, validity. Verification recomputes SHA-256 from the
-- `certificates` rows and compares to the chain.

-- Institution contact info (identity/authorization lives on-chain; this is metadata).
CREATE TABLE IF NOT EXISTS institutions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet           TEXT NOT NULL UNIQUE,            -- on-chain issuer address (0x...)
  name             TEXT NOT NULL,
  abbreviation     TEXT,                            -- e.g. FUTMINNA
  website          TEXT,
  country          TEXT,
  city             TEXT,
  accreditation_no TEXT,                            -- accreditation / registration number
  contact_email    TEXT,
  contact_phone    TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);

-- Student certificate details. The exact fields below, joined by '|' in this order,
-- form the canonical preimage that is SHA-256'd (see CLAUDE.md).
CREATE TABLE IF NOT EXISTS certificates (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_hash      TEXT NOT NULL UNIQUE,           -- 0x + 64 hex; the on-chain key
  full_name      TEXT NOT NULL,
  matric_number  TEXT NOT NULL,
  degree_title   TEXT NOT NULL,
  department     TEXT NOT NULL,
  grad_year      TEXT NOT NULL,
  institution_id INTEGER NOT NULL,
  issued_at      TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

-- Audit log of public verification attempts (record-keeping per spec §8).
CREATE TABLE IF NOT EXISTS verification_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_hash   TEXT NOT NULL,
  result      TEXT NOT NULL CHECK (result IN ('valid','invalid','revoked','not_found','hash_mismatch')),
  verifier_ip TEXT,
  checked_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_cert_hash ON verification_logs(cert_hash);
