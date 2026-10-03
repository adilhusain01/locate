"use client";

import { useAccount } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtHealth, fmtToken, fmtUsdWad, fmtUsdg, WAD } from "@/lib/format";
import { markets, useMarkets, useMyAccount } from "@/lib/locate";
import { LenderRow } from "@/components/lender-row";

export default function PortfolioPage() {
  const { address } = useAccount();
  const me = useMyAccount();
  const { rows } = useMarkets();
  const netCollateralUsd = me.collateral !== undefined && me.pendingFees !== undefined ? (me.collateral - (me.pendingFees > me.collateral ? me.collateral : me.pendingFees)) * 10n ** 12n : undefined;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-[-0.025em] sm:text-5xl">Portfolio</h1>
        <p className="mt-2 text-base text-muted-foreground">{address ? "Your shorts, collateral and lending positions." : "Connect a wallet to see your positions."}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Collateral</CardDescription><CardTitle className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{fmtUsdg(me.collateral)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Pending fees {fmtUsdg(me.pendingFees)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Health</CardDescription><CardTitle className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{fmtHealth(me.health)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{me.auctionStart && me.auctionStart > 0n ? "Auction open on this account" : "No auction"}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Open shorts</CardDescription><CardTitle className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{me.borrowedTokens?.length ?? "…"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Across {markets.length} markets</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Router</CardDescription><CardTitle className="text-xl font-semibold">{me.routerApproved === undefined ? "…" : me.routerApproved ? "Approved" : "Not approved"}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Operator rights for one-transaction short and cover</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-xl font-semibold">Shorts</CardTitle><CardDescription>Liquidation price is where health reaches 1.00 for that position alone.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Ticker</TableHead><TableHead className="text-right">Shares owed</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">Liquidation price</TableHead></TableRow></TableHeader>
            <TableBody>
              {markets.map((m, i) => {
                const debt = me.positions?.[i] ?? 0n;
                if (debt === 0n) return null;
                const row = rows?.find((r) => r.ticker === m.ticker);
                const price = row?.priceWad ?? 0n;
                const liqPrice = row && netCollateralUsd !== undefined && debt > 0n ? (netCollateralUsd * WAD * WAD) / (debt * row.liqThresholdWad) : undefined;
                return (
                  <TableRow key={m.token}>
                    <TableCell className="font-medium">{m.ticker}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtToken(debt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsdWad(price)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsdWad((debt * price) / WAD)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtUsdWad(liqPrice)}</TableCell>
                  </TableRow>
                );
              })}
              {me.borrowedTokens?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No open shorts</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-xl font-semibold">Lending</CardTitle><CardDescription>Shares in each pool, effective shares after the multiplier, and USDG waiting to be claimed.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Ticker</TableHead><TableHead className="text-right">Deposited</TableHead><TableHead className="text-right">Effective shares</TableHead><TableHead className="text-right">Claimable</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {markets.map((m) => <LenderRow key={m.token} market={m} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
