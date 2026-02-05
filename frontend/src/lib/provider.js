import { ethers } from "ethers";

export function getReadProvider(dep) {
  const rpcUrl = dep.rpcUrl || import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
  return new ethers.JsonRpcProvider(rpcUrl);
}

export async function getMetamaskSigner() {
  if (!window.ethereum) throw new Error("MetaMask not found (window.ethereum missing)");
  const bp = new ethers.BrowserProvider(window.ethereum);
  await bp.send("eth_requestAccounts", []);
  return bp.getSigner();
}

export function getEnvSigner(rpcUrl) {
  const pk = import.meta.env.VITE_AGENT_PK;
  if (!pk) throw new Error("VITE_AGENT_PK not set");
  const provider = new ethers.JsonRpcProvider(rpcUrl || import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545");
  return new ethers.Wallet(pk, provider);
}
