// Wallet adapter: EIP-6963 multi-injected discovery + WalletConnect (mobile/QR), with a
// small styled picker modal. Returns an ethers BrowserProvider wrapping the chosen wallet.
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm";
import { getWalletConnectProjectId } from "./config.js";

const SEPOLIA_DEC = 11155111;
const SEPOLIA_HEX = "0xaa36a7";
const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

// ---------- EIP-6963 discovery ----------
const injected = new Map(); // rdns -> { info, provider }
window.addEventListener("eip6963:announceProvider", (e) => {
  const { info, provider } = e.detail;
  injected.set(info.rdns, { info, provider });
});
function requestInjected() {
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}
requestInjected(); // announce on load

function injectedWallets() {
  const list = [...injected.values()];
  // Fallback for wallets that don't yet support EIP-6963.
  if (list.length === 0 && typeof window.ethereum !== "undefined") {
    list.push({ info: { name: "Browser Wallet", icon: null, rdns: "legacy.injected" }, provider: window.ethereum });
  }
  return list;
}

// ---------- Mobile wallet apps ----------
// A browser cannot list the apps installed on a phone (privacy). The reliable route is
// a deep link that reopens this page INSIDE the wallet's own browser, where the wallet
// injects itself and connects like a desktop extension.
const isMobile = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");

const MOBILE_WALLETS = [
  {
    name: "MetaMask",
    initial: "M",
    link: () => `https://metamask.app.link/dapp/${location.host}${location.pathname}${location.search}`,
  },
  {
    name: "Trust Wallet",
    initial: "T",
    link: () => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(location.href)}`,
  },
  {
    name: "Coinbase Wallet",
    initial: "C",
    link: () => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(location.href)}`,
  },
];

// ---------- WalletConnect ----------
let wcProvider;
let wcInitPromise; // memoized so a background pre-init and a user tap never double-init
function initWC() {
  if (!wcInitPromise) {
    wcInitPromise = (async () => {
      const projectId = getWalletConnectProjectId();
      if (!projectId) {
        throw new Error("WalletConnect is not configured (missing project ID).");
      }
      const { EthereumProvider } = await import("https://esm.sh/@walletconnect/ethereum-provider@2.23.10");
      wcProvider = await EthereumProvider.init({
        projectId,
        chains: [SEPOLIA_DEC],
        showQrModal: true,
        rpcMap: { [SEPOLIA_DEC]: SEPOLIA_RPC },
        metadata: {
          name: "CertVerify",
          description: "Academic certificate verification",
          url: location.origin,
          icons: [`${location.origin}/favicon.ico`],
          // The https URL the wallet app sends the user back to after it handles a
          // request. Include the pathname so the phone returns to THIS page (origin
          // alone would land on the verify page). No `native` entry — an empty native
          // scheme makes some wallets attempt (and botch) a native redirect first.
          redirect: { universal: location.origin + location.pathname },
        },
      });
      return wcProvider;
    })().catch((e) => {
      wcInitPromise = undefined; // allow a retry after a failed init
      throw e;
    });
  }
  return wcInitPromise;
}

// Pre-initialize in the background shortly after page load: downloads the library AND
// completes the relay handshake, so tapping "WalletConnect" shows the wallet list
// immediately instead of spending seconds on init first.
if (getWalletConnectProjectId()) {
  setTimeout(() => { initWC().catch(() => {}); }, 1500);
}

// While the user is off approving in the wallet app, the browser suspends this page and
// its relay WebSocket with it. Without this, coming back to the browser meant waiting
// out a slow automatic reconnect before the session events could arrive — the "returns
// to Chrome but takes forever to actually connect" symptom. Reopen the transport the
// moment the page becomes visible again.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !wcProvider) return;
  try {
    // EthereumProvider nests its SignClient under .signer — there is no .client on the
    // provider itself (verified against @walletconnect/ethereum-provider 2.x source).
    const relayer = wcProvider.signer?.client?.core?.relayer;
    if (!relayer || relayer.connected) return;
    const restart = relayer.restartTransport || relayer.transportOpen;
    if (typeof restart === "function") restart.call(relayer).catch(() => {});
  } catch { /* best-effort */ }
});

async function getWalletConnectProvider() {
  const p = await initWC();
  // Record the intent BEFORE the round-trip. If the browser discards this tab while the
  // user is approving in the wallet app, silentReconnect can still restore the session
  // when they come back — otherwise the page would look disconnected despite a live session.
  // But if the attempt visibly fails or is cancelled, ROLL BACK: leaving 'walletconnect'
  // here would clobber a previously working injected-wallet auto-reconnect. (A discarded
  // tab never reaches the catch, so the rescue path above is preserved.)
  const prev = localStorage.getItem(LAST);
  try { localStorage.setItem(LAST, "walletconnect"); } catch {}
  try {
    await p.connect(); // opens the WalletConnect modal / deep-links to the wallet
  } catch (e) {
    try { prev === null ? localStorage.removeItem(LAST) : localStorage.setItem(LAST, prev); } catch {}
    throw e;
  }
  return p;
}

// ---------- Network ----------
async function ensureSepolia(eip1193) {
  try {
    const current = await eip1193.request({ method: "eth_chainId" });
    if (current === SEPOLIA_HEX) return;
    await eip1193.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_HEX }] });
  } catch (err) {
    if (err && err.code === 4902) {
      await eip1193.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: SEPOLIA_HEX, chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [SEPOLIA_RPC], blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
    }
    // Otherwise let it pass; a wrong-network tx will surface a clear error downstream.
  }
}

// ---------- Picker modal ----------
function openWalletPicker() {
  requestInjected();
  return new Promise((resolve, reject) => {
    setTimeout(() => buildModal(resolve, reject), 80); // give wallets a tick to announce
  });
}

function buildModal(resolve, reject) {
  const overlay = document.createElement("div");
  overlay.className = "wallet-overlay";
  const modal = document.createElement("div");
  modal.className = "wallet-modal";
  overlay.appendChild(modal);

  const head = document.createElement("div");
  head.className = "wallet-modal-head";
  head.innerHTML = `<h3>Connect a wallet</h3>`;
  const close = document.createElement("button");
  close.className = "wallet-close";
  close.setAttribute("aria-label", "Close");
  close.innerHTML = "&times;";
  head.appendChild(close);
  modal.appendChild(head);

  const list = document.createElement("div");
  list.className = "wallet-list";
  modal.appendChild(list);

  const err = document.createElement("p");
  err.className = "wallet-error";
  modal.appendChild(err);

  let done = false;
  const cleanup = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") cancel(); };
  const cancel = () => { if (done) return; done = true; cleanup(); reject(new Error("Connection cancelled")); };
  const choose = (provider, info) => { if (done) return; done = true; cleanup(); resolve({ provider, info }); };
  const showError = (m) => { err.textContent = m; err.classList.add("show"); };

  close.onclick = cancel;
  overlay.onclick = (e) => { if (e.target === overlay) cancel(); };
  document.addEventListener("keydown", onKey);

  // Injected wallets (desktop extensions, and wallets' in-app browsers on mobile)
  const wallets = injectedWallets();
  const mobile = isMobile();
  if (wallets.length === 0) {
    const none = document.createElement("p");
    none.className = "wallet-hint";
    none.textContent = mobile
      ? "Use WalletConnect to approve in your wallet app and come straight back here."
      : "No browser wallet detected. Use WalletConnect below, or install MetaMask.";
    list.appendChild(none);
  }
  for (const w of wallets) {
    const b = document.createElement("button");
    b.className = "wallet-opt";
    const icon = w.info.icon
      ? `<img src="${w.info.icon}" alt="" />`
      : `<span class="wallet-ico-fallback">${(w.info.name || "?").charAt(0)}</span>`;
    b.innerHTML = `${icon}<span>${w.info.name || "Wallet"}</span>`;
    b.onclick = () => choose(w.provider, w.info);
    list.appendChild(b);
  }

  // WalletConnect is built first so a phone can show it ABOVE the deep links: it hands
  // you to the wallet app to approve and then returns you to THIS browser, session intact.
  const wcLabel = mobile ? "· approve in your wallet, return here" : "· mobile / QR";
  const wcInner = `<span class="wallet-ico-fallback wc">⛓</span><span>WalletConnect <span class="faint">${wcLabel}</span></span>`;
  const wc = document.createElement("button");
  wc.className = "wallet-opt";
  wc.innerHTML = wcInner;

  const addSep = (text) => {
    const s = document.createElement("div");
    s.className = "wallet-sep";
    s.innerHTML = `<span>${text}</span>`;
    list.appendChild(s);
  };

  if (mobile) {
    addSep("recommended");
    list.appendChild(wc);
    // Deep links stay available, but they REPLACE this browser with the wallet's own
    // in-app browser — you don't come back here afterwards.
    addSep("or open inside a wallet app");
    for (const w of MOBILE_WALLETS) {
      const b = document.createElement("button");
      b.className = "wallet-opt";
      b.innerHTML =
        `<span class="wallet-ico-fallback">${w.initial}</span>` +
        `<span>${w.name} <span class="faint">· leaves this page</span></span>` +
        `<span class="faint" style="margin-left:auto;font-size:13px">↗</span>`;
      b.onclick = () => { location.href = w.link(); };
      list.appendChild(b);
    }
  } else {
    addSep("or");
    list.appendChild(wc);
  }
  wc.onclick = async () => {
    err.classList.remove("show");
    wc.disabled = true;
    wc.innerHTML = `<span class="spinner"></span><span>Opening WalletConnect…</span>`;
    try {
      const provider = await getWalletConnectProvider();
      // Explicit rdns so isWC detection never depends on this display label.
      choose(provider, { name: "WalletConnect", rdns: "walletconnect" });
    } catch (e) {
      wc.disabled = false;
      wc.innerHTML = wcInner;
      // Closing the modal without approving surfaces as an upstream error string —
      // present it as the cancel it is, not a failure.
      const msg = /connection request reset|proposal expired|user rejected/i.test(e?.message || "")
        ? "Cancelled — tap WalletConnect to try again."
        : (e.message || "WalletConnect failed");
      showError(msg);
    }
  };

  document.body.appendChild(overlay);
}

// ---------- Session persistence ----------
const LAST = "certverify.lastWallet"; // remembers which wallet to silently reconnect
let activeProvider = null;
let onChangeCb = null;
const wired = new WeakSet();

function rdnsOf(info) {
  if (info?.rdns) return info.rdns;
  return info?.name === "WalletConnect" ? "walletconnect" : "legacy.injected";
}

function wireEvents(eip1193) {
  if (!eip1193 || typeof eip1193.on !== "function" || wired.has(eip1193)) return;
  wired.add(eip1193);
  const fire = (...a) => { if (onChangeCb) onChangeCb(...a); };
  eip1193.on("accountsChanged", fire);
  eip1193.on("chainChanged", fire);
  eip1193.on("disconnect", fire);
}

// NOTE on mobile signing hand-off: sign-client itself deep-links the wallet app on every
// session request — it reads WALLETCONNECT_DEEPLINK_CHOICE and navigates to
// `<href>/wc?requestId=…&sessionTopic=…` AFTER the request has published to the relay
// (verified in @walletconnect/sign-client engine.request → handleDeeplinkRedirect).
// Do NOT add a manual deep-link wrapper here: navigating before the publish completes
// freezes this page's relay socket mid-send and the wallet opens to nothing — the exact
// bug such a wrapper would be trying to fix. The built-in only works if the relay socket
// is alive, which the visibilitychange restart above guarantees.

// MetaMask approves a WalletConnect session with ALL of its enabled chains and then
// reports whichever network the app is currently on (often Ethereum mainnet). The
// provider adopts that as the session's default chain — so transactions would be routed
// to MAINNET and the wallet shows an "Ethereum" tx the user can't pay. Sepolia is the
// session's required chain, so this switch resolves locally inside universal-provider:
// no relay round-trip, no wallet prompt.
async function pinSepolia(p) {
  try {
    // WC's eth_chainId returns a decimal number; injected wallets return hex. Number()
    // parses both ("0xaa36a7" -> 11155111).
    const current = Number(await p.request({ method: "eth_chainId" }));
    if (current === SEPOLIA_DEC) return;
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_HEX }] });
  } catch { /* a wrong-chain tx still surfaces a clear wallet-side error */ }
}

async function finalize(eip1193, info, { prompt }) {
  // WalletConnect sessions come back from connect() already holding the accounts, so
  // the eth_requestAccounts prompt below is injected-wallet-only. The chain, however,
  // MUST be pinned for WC (see pinSepolia) — and before ethers.BrowserProvider is
  // built, so its network detection sees Sepolia rather than the wallet's active chain.
  const isWC = rdnsOf(info) === "walletconnect";
  if (isWC) await pinSepolia(eip1193);
  if (prompt && !isWC) await ensureSepolia(eip1193);
  const browserProvider = new ethers.BrowserProvider(eip1193);
  if (prompt && !isWC) await browserProvider.send("eth_requestAccounts", []);
  const accounts = await eip1193.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) throw new Error("No authorized account");
  const signer = await browserProvider.getSigner();
  const address = await signer.getAddress();
  activeProvider = eip1193;
  wireEvents(eip1193);
  // Best-effort persistence — must never fail an otherwise successful connection.
  try { localStorage.setItem(LAST, rdnsOf(info)); } catch {}
  return { provider: browserProvider, signer, address, wallet: info?.name || "Wallet" };
}

// ---------- Public API ----------

/** Open the picker and connect (prompts the wallet). */
export async function connectWallet() {
  const { provider: eip1193, info } = await openWalletPicker();
  return finalize(eip1193, info, { prompt: true });
}

/** Reconnect on page load WITHOUT prompting, if the wallet is still authorized. */
export async function silentReconnect() {
  const last = localStorage.getItem(LAST);
  if (!last) return null;
  try {
    if (last === "walletconnect") {
      if (!getWalletConnectProjectId()) return null;
      const p = await initWC(); // restores a persisted WalletConnect session if present
      if (!p.accounts || p.accounts.length === 0) return null;
      return finalize(p, { name: "WalletConnect", rdns: "walletconnect" }, { prompt: false });
    }
    requestInjected();
    await new Promise((r) => setTimeout(r, 140)); // let wallets announce
    let entry = [...injected.values()].find((w) => w.info.rdns === last);
    if (!entry && last === "legacy.injected" && typeof window.ethereum !== "undefined") {
      entry = { info: { name: "Browser Wallet", rdns: "legacy.injected" }, provider: window.ethereum };
    }
    if (!entry) return null;
    const accounts = await entry.provider.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) return null; // no longer authorized
    return finalize(entry.provider, entry.info, { prompt: false });
  } catch {
    return null;
  }
}

/** Register a callback fired on account/chain/disconnect changes (set once at load). */
export function onWalletChange(cb) {
  onChangeCb = cb;
}

/** Forget the session and drop any WalletConnect session. */
export async function disconnect() {
  localStorage.removeItem(LAST);
  try { if (wcProvider && typeof wcProvider.disconnect === "function") await wcProvider.disconnect(); } catch {}
  activeProvider = null;
}
