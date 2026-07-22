const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { canonicalPreimage, certHash, normalizeHash, FIELDS } = require("../src/hash");

const SAMPLE = {
  fullName: "Hassan Blessing",
  matricNumber: "2021/1/81777CS",
  degreeTitle: "BTech Cyber Security",
  department: "Cyber Security Science",
  yearOfGraduation: "2025",
  institutionName: "Federal University of Technology, Minna",
};

test("canonicalPreimage joins the six fields with | in the fixed order", () => {
  const pre = canonicalPreimage(SAMPLE);
  assert.equal(
    pre,
    "Hassan Blessing|2021/1/81777CS|BTech Cyber Security|Cyber Security Science|2025|Federal University of Technology, Minna"
  );
  assert.equal(FIELDS.length, 6);
});

test("canonicalPreimage throws when a field is missing", () => {
  const { institutionName, ...partial } = SAMPLE;
  assert.throws(() => canonicalPreimage(partial), /missing certificate fields: institutionName/);
});

test("certHash equals an independent SHA-256 of the same preimage (0x + 64 hex)", () => {
  const expected =
    "0x" + crypto.createHash("sha256").update(canonicalPreimage(SAMPLE), "utf8").digest("hex");
  const got = certHash(SAMPLE);
  assert.equal(got, expected);
  assert.match(got, /^0x[0-9a-f]{64}$/);
});

test("certHash is deterministic and tamper-sensitive", () => {
  assert.equal(certHash(SAMPLE), certHash({ ...SAMPLE }));
  const tampered = certHash({ ...SAMPLE, degreeTitle: "BTech Computer Science" });
  assert.notEqual(tampered, certHash(SAMPLE));
});

test("normalizeHash lowercases, 0x-prefixes, and rejects malformed input", () => {
  const bare = "A".repeat(64);
  assert.equal(normalizeHash(bare), "0x" + "a".repeat(64));
  assert.equal(normalizeHash("0x" + "B".repeat(64)), "0x" + "b".repeat(64));
  assert.throws(() => normalizeHash("0x123"), /invalid SHA-256 hash format/);
  assert.throws(() => normalizeHash("zz" + "0".repeat(62)), /invalid SHA-256 hash format/);
  assert.throws(() => normalizeHash(123), /must be a string/);
});
