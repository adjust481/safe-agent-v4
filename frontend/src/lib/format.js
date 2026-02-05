import { ethers } from "ethers";

export const fmt18 = (x) => ethers.formatUnits(x ?? 0n, 18);

export const short = (s) => {
  if (!s || typeof s !== "string") return String(s);
  if (s.length < 10) return s;
  return s.slice(0, 6) + "…" + s.slice(-4);
};
