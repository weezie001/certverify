const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyUint } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// Canonical preimage (must match Node + Solidity — see CLAUDE.md).
function preimage({ name, matric, degree, dept, year, institution }) {
  return [name, matric, degree, dept, year, institution].join("|");
}
function hashOf(fields) {
  // ethers.sha256 over UTF-8 bytes === Solidity sha256(bytes(preimage)).
  return ethers.sha256(ethers.toUtf8Bytes(preimage(fields)));
}

const FUTMINNA = {
  name: "Hassan Blessing",
  matric: "2021/1/81777CS",
  degree: "BTech Cyber Security",
  dept: "Cyber Security Science",
  year: "2025",
  institution: "Federal University of Technology, Minna",
};
const UNILAG = {
  name: "Ada Obi",
  matric: "190401001",
  degree: "BSc Computer Science",
  dept: "Computer Science",
  year: "2024",
  institution: "University of Lagos",
};

describe("CertificateRegistry", function () {
  async function deployFixture() {
    const [admin, futminna, unilag, outsider, verifier] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Factory.deploy();
    await registry.waitForDeployment();
    return { registry, admin, futminna, unilag, outsider, verifier };
  }

  describe("Deployment", function () {
    it("sets the deployer as the platform admin", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      expect(await registry.admin()).to.equal(admin.address);
    });
  });

  describe("registerInstitution (admin only)", function () {
    it("lets the admin register an institution and emits an event", async function () {
      const { registry, futminna } = await loadFixture(deployFixture);
      await expect(registry.registerInstitution(futminna.address, FUTMINNA.institution))
        .to.emit(registry, "InstitutionRegistered")
        .withArgs(futminna.address, FUTMINNA.institution);

      const inst = await registry.institutions(futminna.address);
      expect(inst.registered).to.equal(true);
      expect(inst.name).to.equal(FUTMINNA.institution);
    });

    it("reverts when a non-admin tries to register an institution", async function () {
      const { registry, futminna, outsider } = await loadFixture(deployFixture);
      await expect(
        registry.connect(outsider).registerInstitution(futminna.address, FUTMINNA.institution)
      ).to.be.revertedWithCustomError(registry, "NotAdmin");
    });

    it("rejects the zero address and empty names", async function () {
      const { registry, futminna } = await loadFixture(deployFixture);
      await expect(
        registry.registerInstitution(ethers.ZeroAddress, "X")
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
      await expect(
        registry.registerInstitution(futminna.address, "")
      ).to.be.revertedWithCustomError(registry, "EmptyName");
    });

    it("reverts when registering the same wallet twice", async function () {
      const { registry, futminna } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      await expect(
        registry.registerInstitution(futminna.address, FUTMINNA.institution)
      ).to.be.revertedWithCustomError(registry, "AlreadyRegistered");
    });
  });

  describe("issueCertificate (registered institutions only)", function () {
    it("SECURITY: an unregistered wallet cannot issue a certificate", async function () {
      const { registry, outsider } = await loadFixture(deployFixture);
      const h = hashOf(FUTMINNA);
      await expect(
        registry.connect(outsider).issueCertificate(h)
      ).to.be.revertedWithCustomError(registry, "NotRegisteredInstitution");
    });

    it("lets a registered institution issue and records issuer + timestamp", async function () {
      const { registry, futminna } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      const h = hashOf(FUTMINNA);

      await expect(registry.connect(futminna).issueCertificate(h))
        .to.emit(registry, "CertificateIssued")
        .withArgs(h, futminna.address, anyUint);

      const cert = await registry.certificates(h);
      expect(cert.exists).to.equal(true);
      expect(cert.issuer).to.equal(futminna.address);
      expect(cert.revoked).to.equal(false);
    });

    it("rejects duplicate issuance of the same hash", async function () {
      const { registry, futminna } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      const h = hashOf(FUTMINNA);
      await registry.connect(futminna).issueCertificate(h);
      await expect(
        registry.connect(futminna).issueCertificate(h)
      ).to.be.revertedWithCustomError(registry, "CertificateExists");
    });

    it("rejects the zero hash", async function () {
      const { registry, futminna } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      await expect(
        registry.connect(futminna).issueCertificate(ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "InvalidHash");
    });
  });

  describe("verifyCertificate (public, auto-identifies the university)", function () {
    it("returns valid + the correct issuing university for any registered uni", async function () {
      const { registry, futminna, unilag, verifier } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      await registry.registerInstitution(unilag.address, UNILAG.institution);

      const hF = hashOf(FUTMINNA);
      const hU = hashOf(UNILAG);
      await registry.connect(futminna).issueCertificate(hF);
      await registry.connect(unilag).issueCertificate(hU);

      // A verifier with no special role queries by hash alone — no university selector.
      const rF = await registry.connect(verifier).verifyCertificate(hF);
      expect(rF.isValid).to.equal(true);
      expect(rF.issuer).to.equal(futminna.address);
      expect(rF.institutionName).to.equal(FUTMINNA.institution);

      const rU = await registry.connect(verifier).verifyCertificate(hU);
      expect(rU.isValid).to.equal(true);
      expect(rU.institutionName).to.equal(UNILAG.institution);
    });

    it("returns not-valid / not-exists for an unknown hash", async function () {
      const { registry } = await loadFixture(deployFixture);
      const r = await registry.verifyCertificate(hashOf(UNILAG));
      expect(r.exists).to.equal(false);
      expect(r.isValid).to.equal(false);
    });

    it("reports a revoked certificate as invalid (record still exists)", async function () {
      const { registry, futminna } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      const h = hashOf(FUTMINNA);
      await registry.connect(futminna).issueCertificate(h);
      await registry.connect(futminna).revokeCertificate(h);

      const r = await registry.verifyCertificate(h);
      expect(r.exists).to.equal(true);
      expect(r.revoked).to.equal(true);
      expect(r.isValid).to.equal(false);
    });
  });

  describe("revokeCertificate (issuer only)", function () {
    it("SECURITY: one university cannot revoke another university's certificate", async function () {
      const { registry, futminna, unilag } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      await registry.registerInstitution(unilag.address, UNILAG.institution);

      const hF = hashOf(FUTMINNA);
      await registry.connect(futminna).issueCertificate(hF);

      // UNILAG (a registered institution) tries to revoke FUTMINNA's certificate.
      await expect(
        registry.connect(unilag).revokeCertificate(hF)
      ).to.be.revertedWithCustomError(registry, "NotIssuer");
    });

    it("SECURITY: not even the admin can revoke an institution's certificate", async function () {
      const { registry, admin, futminna } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      const hF = hashOf(FUTMINNA);
      await registry.connect(futminna).issueCertificate(hF);

      await expect(
        registry.connect(admin).revokeCertificate(hF)
      ).to.be.revertedWithCustomError(registry, "NotIssuer");
    });

    it("lets the issuing institution revoke its own certificate and emits an event", async function () {
      const { registry, futminna } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      const h = hashOf(FUTMINNA);
      await registry.connect(futminna).issueCertificate(h);

      await expect(registry.connect(futminna).revokeCertificate(h))
        .to.emit(registry, "CertificateRevoked")
        .withArgs(h, futminna.address, anyUint);
    });

    it("reverts on revoking a non-existent or already-revoked certificate", async function () {
      const { registry, futminna } = await loadFixture(deployFixture);
      await registry.registerInstitution(futminna.address, FUTMINNA.institution);
      const h = hashOf(FUTMINNA);

      await expect(
        registry.connect(futminna).revokeCertificate(h)
      ).to.be.revertedWithCustomError(registry, "CertificateNotFound");

      await registry.connect(futminna).issueCertificate(h);
      await registry.connect(futminna).revokeCertificate(h);
      await expect(
        registry.connect(futminna).revokeCertificate(h)
      ).to.be.revertedWithCustomError(registry, "AlreadyRevoked");
    });
  });

  describe("computeHash (on-chain SHA-256 precompile)", function () {
    it("matches the off-chain Node/ethers SHA-256 of the canonical preimage", async function () {
      const { registry } = await loadFixture(deployFixture);
      const onChain = await registry.computeHash(preimage(FUTMINNA));
      const offChain = hashOf(FUTMINNA);
      expect(onChain).to.equal(offChain);
    });

    it("produces a different hash when any detail changes (tamper detection)", async function () {
      const { registry } = await loadFixture(deployFixture);
      const original = await registry.computeHash(preimage(FUTMINNA));
      const tampered = await registry.computeHash(
        preimage({ ...FUTMINNA, degree: "BTech Computer Science" })
      );
      expect(tampered).to.not.equal(original);
    });
  });
});
