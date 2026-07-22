# Frontend — CertVerify

No-build static frontend (vanilla JS + ethers via CDN, MetaMask). Calm, editorial,
Claude-inspired design with **light & dark mode** (toggle in the top bar; respects your
system preference and remembers your choice).

## Pages

| File | Surface | Auth |
|---|---|---|
| `index.html` | **Public verification** — paste a hash, get a verdict + the issuing university (auto-detected) | none |
| `university.html` | **University dashboard** — issue & revoke certificates | MetaMask (registered institution wallet) |
| `admin.html` | **Admin panel** — register universities | MetaMask (admin wallet) |

## Design system

`assets/styles.css` — tokens via CSS variables, themed with `[data-theme]`. Inter for UI,
Source Serif 4 for display headings. Warm-paper light mode, deep-slate dark mode, terracotta
accent. No flash on load (theme is set inline in `<head>` before paint).

## Run it

It uses ES modules + `fetch`, so serve over HTTP (not `file://`):

```bash
# from the frontend/ folder, any static server works, e.g.:
npx serve .            # or:  python -m http.server 5173
```

Then open the printed URL. First time, expand **Network settings** on any page and set:
- **Contract address** — the deployed `CertificateRegistry` address (after we deploy to a
  local Hardhat node or Sepolia)
- **Backend API base** — defaults to `http://localhost:4000`

(These are saved in `localStorage`; defaults live in `assets/config.js`.)

## How writes work (non-custodial)

The frontend signs every on-chain write with **MetaMask** — the backend holds no keys:
- **Issue:** compute hash (`POST /api/certificates/hash`) → `issueCertificate(hash)` via MetaMask
  → persist details (`POST /api/certificates`).
- **Revoke:** `revokeCertificate(hash)` via MetaMask.
- **Register:** `registerInstitution(wallet, name)` via MetaMask → store contact info
  (`POST /api/institutions`).

Verification is read-only and needs no wallet — it calls `GET /api/verify/:hash`.

## Files

```
assets/styles.css   design system (light/dark)
assets/config.js    contract address, API base, ABI
assets/eth.js       MetaMask connect + contract + hash helper
assets/ui.js        theme toggle, nav, settings panel, alerts
index.html  university.html  admin.html
```
