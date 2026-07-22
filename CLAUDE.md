# CLAUDE.md — Standing Context

Blockchain-based platform for **verifying academic certificates**. Final-year project
(Hassan Blessing Sudir, FUT Minna, Cyber Security Science). This file is the source of
truth for design intent. Read it before changing anything.

## The core requirement (most important)

This is **ONE platform supporting MANY universities** — not one system per university.
A verifier checks a certificate from *any* registered university through a **single
public page**, and the system figures out which university issued it **automatically**.
The verifier never selects a university. Every design decision — DB schema, contract
logic, UI — must serve this.

## Tech stack

- **Smart contract:** Solidity + Hardhat, deployed to **Ethereum Sepolia** testnet.
- **Hashing:** SHA-256. Backend computes the canonical hash (Node `crypto`); the
  contract carries a `sha256()` precompile helper (`computeHash`) used by tests and as
  a **view-only** recompute oracle (eth_call, never a transaction).
- **Backend:** Node.js + ethers.js → talks to the contract and a **MySQL** database.
- **Frontend:** admin panel, university dashboard, public verification page. Wallet auth
  via MetaMask.
- **Off-chain MySQL:** student personal data, institution contact info, verification logs.

## On-chain vs off-chain (hard rule)

**On-chain only:** certificate hash, issuing institution identity (wallet), timestamp,
validity status. **Off-chain (MySQL):** all personal / sensitive data. Personal data must
**never** be placed into a transaction (calldata is permanent and public on Sepolia).

## Verification integrity (do NOT just look up and display)

Because student details live off-chain, verification must **RECOMPUTE** the SHA-256 hash
from the stored MySQL details and **compare** it to the on-chain hash. A certificate is
**VALID only if the recomputed hash matches the on-chain hash AND the cert is not revoked.**
This is what detects off-chain tampering (e.g. a corrupt staffer editing a grade in MySQL).

### Canonical preimage (must be identical in Node and Solidity)

```
fullName|matricNumber|degreeTitle|department|yearOfGraduation|institutionName
```

UTF-8 bytes, fields joined by `|`, no surrounding whitespace. Node:
`crypto.createHash('sha256').update(preimage,'utf8').digest()`. Solidity:
`sha256(bytes(preimage))`. Both produce the same `bytes32`.

## Roles & rules

- **Platform admin** registers/approves universities by wallet address (admin-only).
- Only a **registered institution wallet** can issue certificates.
- **Only the issuing institution** can revoke its own certificates — not other
  institutions, not even the admin.
- **Public verification page requires no login.**

## Smart contract surface (`contracts/CertificateRegistry.sol`)

| Function | Access | Notes |
|---|---|---|
| `registerInstitution(wallet, name)` | admin only | emits `InstitutionRegistered` |
| `issueCertificate(certHash)` | registered institution only | rejects duplicates; emits `CertificateIssued` |
| `verifyCertificate(certHash)` | public `view` | returns issuer + institution name (auto-identifies university), validity |
| `revokeCertificate(certHash)` | original issuer only | emits `CertificateRevoked` |
| `computeHash(preimage)` | public `pure` | `sha256()` helper; view-only oracle, never send personal data in a tx |

`isValid = exists && !revoked`. Certificate is keyed by its hash → the record stores the
issuer wallet → that is how the platform knows which university issued any given hash.

## Project structure

```
contracts/    Solidity sources + Hardhat tests (test/)
backend/      Node.js + ethers.js API, MySQL access (to be built)
frontend/     admin panel, university dashboard, public verification page (to be built)
database/     MySQL schema for off-chain data
```

## Scripts

- `npm test` — contract unit tests · `npm run e2e` — local end-to-end (deploy + full backend
  flow against a live contract, no MySQL) · `npm run deploy:local` / `npm run deploy:sepolia`.
- `scripts/deploy.js` records to `deployments/<network>.json` and re-syncs the backend ABI.
- See [DEPLOY.md](DEPLOY.md) for local + Sepolia steps.

## Dev workflow / guardrails

- **Do not deploy to Sepolia without explicit review.** Show contract changes first.
- The deployer wallet becomes the platform admin. Sepolia secrets live in root `.env`
  (git-ignored) — never commit or share the private key.
- Once a certificate is issued it cannot be edited — only revoked and reissued.
- The deployed contract is immutable; major changes require a new deployment.
- Run `npx hardhat test` after any contract change.
