"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RegimeBadge } from "@/components/regime-badge";
import { fmtPctWad, fmtToken, fmtUsdWad } from "@/lib/format";
import { REAL_TICKERS, useMarkets } from "@/lib/locate";

export default function MarketsPage() {
  const { rows, isLoading, error } = useMarkets();
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Lend a stock token and earn its borrow fee in USDG. Borrow one against USDG to short it. Rates move with utilisation.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">Could not read the chain: {(error as Error).message.split("\n")[0]}</p>}
      <div className="overflow-x-auto rounded-sm border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Session</TableHead>
              <TableHead className="text-right">Supply APY</TableHead>
              <TableHead className="text-right">Borrow APR</TableHead>
              <TableHead className="text-right">Utilisation</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Multiplier</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {rows?.map((m) => (
              <TableRow key={m.token}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {m.ticker}
                    {REAL_TICKERS.has(m.ticker) ? <Badge variant="secondary">faucet token</Badge> : <Badge variant="outline">mock</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtUsdWad(m.priceWad)}</TableCell>
                <TableCell><RegimeBadge regime={m.regime} /></TableCell>
                <TableCell className="text-right tabular-nums">{fmtPctWad(m.supplyRateWad)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPctWad(m.borrowRateWad)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPctWad(m.utilisation)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtToken(m.idle, m.ticker)}</TableCell>
                <TableCell className="text-right tabular-nums">{(Number(m.uiMultiplier) / 1e18).toFixed(6)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/app/lend?ticker=${m.ticker}`}>Lend</Link>
                    <Link className={buttonVariants({ size: "sm" })} href={`/app/short?ticker=${m.ticker}`}>Short</Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Supply APY is the borrow rate times utilisation, after the 10 percent insurance share. Session follows Robinhood&apos;s 24/5 feed
        schedule; outside it the last print is used with a widening band, and borrowing pauses in the last 30 minutes before the open.
      </p>
    </div>
  );
}
