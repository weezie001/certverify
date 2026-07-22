// Contract helpers + ethers. Wallet connection lives in wallet.js (EIP-6963 + WalletConnect).
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/+esm";
import { ABI, getContractAddress } from "./config.js";
import { connectWallet, silentReconnect, onWalletChange, disconnect } from "./wallet.js";

export { ethers, connectWallet, silentReconnect, onWalletChange, disconnect };

/** Contract bound to a signer (for writes) or provider (for reads). */
export function getContract(runner) {
  const addr = getContractAddress();
  if (!addr) {
    throw new Error("Contract address is not set. Open “Network settings” and paste the deployed address.");
  }
  return new ethers.Contract(addr, ABI, runner);
}

export function shortAddr(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}

/** Compute the canonical certificate hash via the backend (single source of truth). */
export async function computeHashViaApi(apiBase, details) {
  const res = await fetch(`${apiBase}/api/certificates/hash`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(details),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "failed to compute hash");
  return (await res.json()).hash;
}
