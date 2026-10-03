"use client";

import Link from "next/link";
import { formatUnits } from "viem";
import { LandingProviders } from "@/components/landing-providers";
import { RegimeBadge } from "@/components/regime-badge";
import { fmtPctWad, fmtToken, fmtUsdWad, WAD } from "@/lib/format";
import { REAL_TICKERS, useMarkets } from "@/lib/locate";

function Row({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono tabular" : ""} text-sm text-foreground`}>{value}</span>
    </div>
  );
}

function TicketInner() {
  const { rows, isLoading } = useMarkets();
  const m = rows?.[0];
  const updated = m?.updatedAt ? new Date(Number(m.updatedAt) * 1000) : undefined;
  return (
    <div className="rounded-xl border card-wash wash-cobalt p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Borrow ticket</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight">{m?.ticker ?? "NVDA"}</p>
        </div>
        <div className="text-right">
          <p className="font-display tabular text-3xl font-bold tracking-tight">{isLoading ? "…" : fmtUsdWad(m?.priceWad)}</p>
          <div className="mt-1 flex justify-end">{m ? <RegimeBadge regime={m.regime} /> : <span className="text-xs text-muted-foreground">reading chain</span>}</div>
        </div>
      </div>
      <div className="mt-4">
        <Row label="Borrow APR" value={fmtPctWad(m?.borrowRateWad)} />
        <Row label="Supply APY, paid in USDG" value={fmtPctWad(m?.supplyRateWad)} />
        <Row label="Utilisation" value={fmtPctWad(m?.utilisation)} />
        <Row label="Available to borrow" value={fmtToken(m?.idle, m?.ticker ?? "")} />
        <Row label="Initial ratio / liquidation" value={m ? `${(Number(m.initialRatioWad) / 1e18).toFixed(2)}x / ${(Number(m.liqThresholdWad) / 1e18).toFixed(2)}x` : "…"} />
        <Row label="ERC-8056 multiplier" value={m ? (Number(m.uiMultiplier) / 1e18).toFixed(6) : "…"} />
        <Row label="Last print" value={updated ? updated.toUTCString().replace(" GMT", " UTC") : "…"} />
      </div>
      <div className="mt-5 flex gap-2">
        <Link href="/app/short?ticker=NVDA" className="key inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Short NVDA</Link>
        <Link href="/app/lend?ticker=NVDA" className="inline-flex h-9 items-center rounded-md border bg-card px-4 text-sm font-medium">Lend NVDA</Link>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Live from Robinhood Chain testnet. Prices are the mainnet Chainlink prints, mirrored.</p>
    </div>
  );
}

export function LiveTicket() {
  return (
    <LandingProviders>
      <TicketInner />
    </LandingProviders>
  );
}

function MarketsInner() {
  const { rows } = useMarkets();
  const totalLent = rows?.reduce((acc, r) => acc + (r.totalAssets * r.priceWad) / WAD, 0n);
  const best = rows?.reduce((acc, r) => (r.supplyRateWad > acc ? r.supplyRateWad : acc), 0n);
  return (
    <div>
      <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        <div className="card-wash wash-cobalt p-5"><p className="text-sm text-muted-foreground">Markets live</p><p className="mt-1 font-display tabular text-3xl font-bold tracking-tight">{rows ? rows.length : "…"}</p><p className="mt-1 text-xs text-muted-foreground">{rows ? `${rows.filter((r) => REAL_TICKERS.has(r.ticker)).length} real faucet tokens, the rest mocks` : ""}</p></div>
        <div className="card-wash wash-cobalt p-5"><p className="text-sm text-muted-foreground">Lent to the pools</p><p className="mt-1 font-display tabular text-3xl font-bold tracking-tight">{totalLent === undefined ? "…" : fmtUsdWad(totalLent)}</p><p className="mt-1 text-xs text-muted-foreground">at the current prints</p></div>
        <div className="card-wash wash-cobalt p-5"><p className="text-sm text-muted-foreground">Best supply APY right now</p><p className="mt-1 font-display tabular text-3xl font-bold tracking-tight">{best === undefined ? "…" : fmtPctWad(best)}</p><p className="mt-1 text-xs text-muted-foreground">rates follow utilisation</p></div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2 font-medium">Ticker</th><th className="px-3 py-2 text-right font-medium">Price</th><th className="px-3 py-2 font-medium">Session</th><th className="px-3 py-2 text-right font-medium">Supply APY</th><th className="px-3 py-2 text-right font-medium">Borrow APR</th><th className="px-3 py-2 text-right font-medium">Available</th></tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.token} className="border-t">
                <td className="px-3 py-2 font-medium">{r.ticker}{REAL_TICKERS.has(r.ticker) && <span className="ml-2 text-xs text-muted-foreground">faucet token</span>}</td>
                <td className="px-3 py-2 text-right font-mono tabular">{fmtUsdWad(r.priceWad)}</td>
                <td className="px-3 py-2"><RegimeBadge regime={r.regime} /></td>
                <td className="px-3 py-2 text-right font-mono tabular">{fmtPctWad(r.supplyRateWad)}</td>
                <td className="px-3 py-2 text-right font-mono tabular">{fmtPctWad(r.borrowRateWad)}</td>
                <td className="px-3 py-2 text-right font-mono tabular">{formatUnits(r.idle, 18).split(".")[0]} {r.ticker}</td>
              </tr>
            ))}
            {!rows && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Reading the chain…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LiveMarkets() {
  return (
    <LandingProviders>
      <MarketsInner />
    </LandingProviders>
  );
}
