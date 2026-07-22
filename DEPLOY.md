# Deployment guide

## Local end-to-end (no MySQL, no real ETH)

```bash
npm install            # root (Hardhat)
npm run e2e            # deploy a fresh contract + run the full backend flow against it
```

`npm run e2e` deploys `CertificateRegistry` to the in-process Hardhat network and exercises
the real backend hashing + verification logic: register → issue → verify (VALID, university
auto-detected) → tamper (HASH_MISMATCH) → cross-revoke blocked → revoke → REVOKED → NOT_FOUND.

### Click through the UI locally (optional)

```bash
# terminal 1 — a persistent local chain
npm run node                      # Hardhat node on http://127.0.0.1:8545 (prints test accounts + keys)

# terminal 2 — deploy to it
npm run deploy:local              # prints the contract address; writes deployments/localhost.json

# terminal 3 — backend (needs MySQL; see database/schema.sql)
cd backend && cp .env.example .env   # set RPC_URL=http://127.0.0.1:8545, CONTRACT_ADDRESS=<addr>, DB_*
npm start

# terminal 4 — frontend
cd frontend && npx serve .        # open the URL, paste the address in "Network settings"
```
In MetaMask: add network `http://127.0.0.1:8545` (chainId 31337) and import one of the
Hardhat test private keys to act as admin/university.

## Sepolia testnet

You already have a funded Sepolia wallet — here's the one-command path.

1. **Create the root `.env`** (it is git-ignored — your private key never leaves your machine,
   and never paste it into chat):
   ```
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<your-key>   # or Alchemy/public RPC
   DEPLOYER_PRIVATE_KEY=<the private key of your funded wallet>
   ETHERSCAN_API_KEY=<optional, for verification>
   ```
   > The wallet that deploys becomes the **platform admin**. Use the admin wallet here.

2. **Deploy:**
   ```bash
   npm run deploy:sepolia
   ```
   This prints the deployed address and writes `deployments/sepolia.json`.

3. **Point the apps at it:**
   - `backend/.env` → `RPC_URL=<your Sepolia RPC>` and `CONTRACT_ADDRESS=<deployed address>`
   - Frontend → open **Network settings** on any page, paste the address (+ backend API base)

4. **In MetaMask:** switch to the Sepolia network. The admin wallet can register universities;
   registered university wallets can issue/revoke.

## Web hosting on Vercel (frontend + API + Turso)

The whole app deploys as one Vercel project: the static frontend, the API as serverless
functions under `/api/*` (in the `api/` folder), and Turso as the database. The smart
contract is already public on Sepolia.

### One-time setup

1. Install the CLI and log in:
   ```bash
   npm i -g vercel
   vercel login
   ```
2. From the project root (`BLOCK CHN/`), link the project:
   ```bash
   vercel link
   ```

### Set environment variables on Vercel

These mirror `backend/.env` (the file itself is never uploaded). Add them for Production
(and Preview) — via the Vercel dashboard (Project → Settings → Environment Variables) or CLI:
```bash
vercel env add RPC_URL              # https://ethereum-sepolia-rpc.publicnode.com
vercel env add CONTRACT_ADDRESS     # 0x217B1dF18AD33707aB0289a813483577c9a14E03
vercel env add TURSO_DATABASE_URL   # libsql://<your-db>.turso.io
vercel env add TURSO_AUTH_TOKEN     # <your Turso token>
```

### Deploy

```bash
vercel          # preview deploy (gives a test URL)
vercel --prod   # production deploy
```

Vercel serves the frontend at `/`, the functions at `/api/*` (same origin, so the frontend's
API base resolves to `""` automatically). Schema is already created on Turso via `npm run db:init`.

### Notes
- The contract stays on Sepolia; the deployed site reads it via the functions and writes via
  the visitor's MetaMask. No keys live on Vercel.
- Re-run `npm run db:init` only if you reset the Turso database.

### Safety notes
- `.env` is git-ignored. Do not commit it; do not share the private key.
- The contract is immutable once deployed — redeploying creates a new instance with a new
  address and a fresh (empty) registry.
- Get free Sepolia ETH from a faucet if the deployer balance is low (the deploy script prints it).
