import { formatUnits } from "viem";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });

export const WAD = 10n ** 18n;

export function fmtUsdWad(value: bigint | undefined) {
  if (value === undefined) return "…";
  return usd.format(Number(formatUnits(value, 18)));
}

export function fmtUsdg(value: bigint | undefined) {
  if (value === undefined) return "…";
  return `${num.format(Number(formatUnits(value, 6)))} USDG`;
}

export function fmtToken(value: bigint | undefined, symbol = "", decimals = 18) {
  if (value === undefined) return "…";
  return `${num.format(Number(formatUnits(value, decimals)))}${symbol ? ` ${symbol}` : ""}`;
}

export function fmtPctWad(value: bigint | undefined) {
  if (value === undefined) return "…";
  return pct.format(Number(formatUnits(value, 18)));
}

export function fmtHealth(value: bigint | undefined) {
  if (value === undefined) return "…";
  if (value >= 10n ** 24n) return "no debt";
  return (Number(formatUnits(value, 18))).toFixed(2);
}

export const regimeLabel = ["Open", "Closed", "Paused", "Degraded"] as const;
export const regimeTone: Record<number, string> = {
  0: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  1: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100",
  2: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  3: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
};

export function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
