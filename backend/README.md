# Backend — Node.js + ethers.js + MySQL

Bridges the `CertificateRegistry` contract and the off-chain MySQL database. **Non-custodial:**
the backend holds **no private keys** and sends **no transactions**. All on-chain writes
(register / issue / revoke) are signed by **MetaMask on the frontend**. The backend computes
hashes, persists off-chain details *after* confirming the on-chain record, and performs the
integrity-checked verification.

## Setup

```bash
cd backend
npm install
cp .env.example .env          # set RPC_URL, CONTRACT_ADDRESS (DB defaults to a local file)
node scripts/sync-abi.js      # copy ABI from ../artifacts (after `npx hardhat compile`)
npm run db:init               # create tables (local file by default; or Turso if configured)
npm test                      # unit tests (incl. real libSQL file)
npm start                     # serve on PORT (default 4000)
```

## Endpoints

| Method & path | Purpose | Auth |
|---|---|---|
| `GET /health` | liveness | none |
| `GET /api/verify/:hash` | **integrity-checked** verification; returns verdict + issuing university (auto-detected) | none (public) |
| `POST /api/certificates/hash` | compute the canonical hash for given details (so the frontend knows what to submit on-chain) | — |
| `POST /api/certificates` | persist off-chain details after on-chain issuance (confirms chain first) | issuer wallet |
| `POST /api/institutions` | store contact metadata after on-chain registration (confirms chain first) | admin/institution |
| `GET /api/institutions/:wallet` | fetch institution metadata | none |

### Verification verdicts (`GET /api/verify/:hash`)

`valid` · `revoked` · `not_found` · `hash_mismatch` (off-chain details were tampered with)
— mirrored into `verification_logs.result`. A cert is `valid` **only if** the SHA-256
recomputed from the stored MySQL details equals the on-chain hash **and** it isn't revoked.

## Layout

```
src/config.js              env
src/hash.js                canonical preimage + SHA-256 + hash validation
src/chain.js               read-only ethers contract (verify / institution reads)
src/db.js                  libSQL client + queries (local file or Turso)
src/services/verifyService.js        recompute-and-compare (the core integrity logic)
src/services/certificateService.js   prepare hash / persist after on-chain confirm
src/services/institutionService.js   persist contact metadata after on-chain confirm
src/routes/*               express routers
src/app.js  server.js      app wiring + entry
test/                      node:test unit tests (services are dependency-injected)
```
