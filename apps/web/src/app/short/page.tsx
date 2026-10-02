"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { controllerAbi, mockStockTokenAbi, shortRouterAbi } from "@locate/sdk/abis";
import { pathTokenUsdg } from "@locate/sdk/deployments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AmountField } from "@/components/amount-field";
import { MarketPicker } from "@/components/market-picker";
import { TxButton } from "@/components/tx-button";
import { fmtHealth, fmtToken, fmtUsdWad, fmtUsdg, WAD } from "@/lib/format";
import { d, markets, useMarkets, useMyAccount } from "@/lib/locate";

function ShortInner() {
  const params = useSearchParams();
  const [ticker, setTicker] = useState(params.get("ticker") ?? markets[0].ticker);
  const market = markets.find((m) => m.ticker === ticker)!;
  const { rows, refetch: refetchMarkets } = useMarkets();
  const row = rows?.find((r) => r.ticker === ticker);
  const { address } = useAccount();
  const me = useMyAccount();
  const [collateralIn, setCollateralIn] = useState("");
  const [collateralOut, setCollateralOut] = useState("");
  const [shortShares, setShortShares] = useState("");
  const [coverShares, setCoverShares] = useState("");
  const refresh = () => { me.refetch(); refetchMarkets(); };

  const depositUsdg = collateralIn ? parseUnits(collateralIn, 6) : 0n;
  const withdrawUsdg = collateralOut ? parseUnits(collateralOut, 6) : 0n;
  const shortRaw = shortShares ? parseUnits(shortShares, 18) : 0n;
  const coverRaw = coverShares ? parseUnits(coverShares, 18) : 0n;
  const price = row?.priceWad ?? 0n;
  const debt = me.positions?.[market.index] ?? 0n;
  const proceedsUsd = (shortRaw * price) / WAD;
  const minOut = (proceedsUsd * 99n) / (100n * 10n ** 12n); // 1 percent slippage, USDG units
  const maxIn = ((coverRaw * price) / WAD * 102n) / (100n * 10n ** 12n);
  const needsUsdgApproval = depositUsdg > 0n && (me.usdgAllowance ?? 0n) < depositUsdg;
  const marginNeeded = row ? ((shortRaw * price) / WAD * row.initialRatioWad) / WAD - proceedsUsd : 0n; // extra USD beyond proceeds
  const path = pathTokenUsdg(market.token, d.usdg);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Short</h1>
          <p className="mt-1 text-sm text-muted-foreground">Post USDG, borrow the token, sell it in one transaction. The proceeds count as margin.</p>
        </div>
        <MarketPicker value={ticker} onChange={setTicker} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Collateral</CardDescription><CardTitle className="text-xl tabular-nums">{fmtUsdg(me.collateral)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Fees pending {fmtUsdg(me.pendingFees)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Health</CardDescription><CardTitle className="text-xl tabular-nums">{fmtHealth(me.health)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Liquidation below 1.00</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>{ticker} short</CardDescription><CardTitle className="text-xl tabular-nums">{fmtToken(debt, ticker)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Worth {fmtUsdWad((debt * price) / WAD)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>{ticker} price</CardDescription><CardTitle className="text-xl tabular-nums">{fmtUsdWad(price)}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">Borrow APR {row ? (Number(row.borrowRateWad) / 1e16).toFixed(2) : "…"}%</CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Collateral</CardTitle><CardDescription>USDG in wallet {fmtUsdg(me.usdgBalance)}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <AmountField id="cin" label="Deposit" unit="USDG" value={collateralIn} onChange={setCollateralIn} max={me.usdgBalance !== undefined ? formatUnits(me.usdgBalance, 6) : undefined} />
            <div className="flex justify-end">
              {needsUsdgApproval ? (
                <TxButton label="Approve USDG" disabled={!address} write={() => ({ address: d.usdg, abi: mockStockTokenAbi, functionName: "approve", args: [d.controller, depositUsdg] })} onDone={refresh} />
              ) : (
                <TxButton label="Deposit collateral" disabled={!address || depositUsdg === 0n} write={() => ({ address: d.controller, abi: controllerAbi, functionName: "depositCollateral", args: [depositUsdg, address!] })} onDone={() => { setCollateralIn(""); refresh(); }} />
              )}
            </div>
            <AmountField id="cout" label="Withdraw" unit="USDG" value={collateralOut} onChange={setCollateralOut} max={me.collateral !== undefined ? formatUnits(me.collateral, 6) : undefined} hint="Blocked if it would take you under the initial ratio." />
            <div className="flex justify-end">
              <TxButton label="Withdraw collateral" variant="outline" disabled={!address || withdrawUsdg === 0n} write={() => ({ address: d.controller, abi: controllerAbi, functionName: "withdrawCollateral", args: [withdrawUsdg, address!] })} onDone={() => { setCollateralOut(""); refresh(); }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Short {ticker}</CardTitle>
            <CardDescription>Needs the router approved once as your operator. Sold on Uniswap with 1 percent slippage allowance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {me.routerApproved === false && (
              <TxButton label="Approve Locate router" variant="outline" disabled={!address} write={() => ({ address: d.controller, abi: controllerAbi, functionName: "setOperator", args: [d.shortRouter, true] })} onDone={refresh} />
            )}
            <AmountField id="short" label="Shares to short" unit={ticker} value={shortShares} onChange={setShortShares} hint={shortRaw > 0n ? `Proceeds about ${fmtUsdWad(proceedsUsd)}; extra margin needed about ${fmtUsdWad(marginNeeded > 0n ? marginNeeded : 0n)}` : undefined} />
            <div className="flex justify-end">
              <TxButton label="Short" disabled={!address || shortRaw === 0n || me.routerApproved === false || row?.borrowPaused || row?.regime === 2 || row?.regime === 3} write={() => ({ address: d.shortRouter, abi: shortRouterAbi, functionName: "short", args: [market.token, shortRaw, path, minOut] })} onDone={() => { setShortShares(""); refresh(); }} />
            </div>
            <AmountField id="cover" label="Shares to cover" unit={ticker} value={coverShares} onChange={setCoverShares} max={formatUnits(debt, 18)} hint="Bought back from your collateral with a 2 percent allowance; the change goes back to collateral." />
            <div className="flex justify-end">
              <TxButton label="Cover" variant="outline" disabled={!address || coverRaw === 0n || me.routerApproved === false} write={() => ({ address: d.shortRouter, abi: shortRouterAbi, functionName: "cover", args: [market.token, coverRaw, path, maxIn] })} onDone={() => { setCoverShares(""); refresh(); }} />
            </div>
            {(row?.regime === 2 || row?.regime === 3) && <p className="text-xs text-amber-700 dark:text-amber-300">New borrows are paused while the oracle is {row.regime === 2 ? "paused" : "degraded"}. Repay, cover and withdraw still work.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ShortPage() {
  return <Suspense><ShortInner /></Suspense>;
}
