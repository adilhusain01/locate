"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { lendingPoolAbi, mockStockTokenAbi } from "@locate/sdk/abis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AmountField } from "@/components/amount-field";
import { MarketPicker } from "@/components/market-picker";
import { TxButton } from "@/components/tx-button";
import { fmtPctWad, fmtToken, fmtUsdg } from "@/lib/format";
import { markets, useLenderPosition, useMarkets } from "@/lib/locate";

function LendInner() {
  const params = useSearchParams();
  const [ticker, setTicker] = useState(params.get("ticker") ?? markets[0].ticker);
  const market = markets.find((m) => m.ticker === ticker)!;
  const { rows, refetch: refetchMarkets } = useMarkets();
  const row = rows?.find((r) => r.ticker === ticker);
  const { address } = useAccount();
  const pos = useLenderPosition(market);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const deposit = depositAmount ? parseUnits(depositAmount, 18) : 0n;
  const withdraw = withdrawAmount ? parseUnits(withdrawAmount, 18) : 0n;
  const needsApproval = deposit > 0n && (pos.poolAllowance ?? 0n) < deposit;
  const refresh = () => { pos.refetch(); refetchMarkets(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lend</h1>
          <p className="mt-1 text-sm text-muted-foreground">Deposit a stock token, keep its price and dividends, earn the borrow fee in USDG.</p>
        </div>
        <MarketPicker value={ticker} onChange={setTicker} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Supply APY</CardDescription><CardTitle className="text-2xl tabular-nums">{fmtPctWad(row?.supplyRateWad)}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">Borrow APR {fmtPctWad(row?.borrowRateWad)} at {fmtPctWad(row?.utilisation)} utilisation</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Your position</CardDescription><CardTitle className="text-2xl tabular-nums">{fmtToken(pos.maxWithdraw, ticker)}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {pos.effectiveShares !== undefined && `${formatUnits(pos.effectiveShares, 18)} effective shares at multiplier ${row ? (Number(row.uiMultiplier) / 1e18).toFixed(6) : "…"}`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Claimable yield</CardDescription><CardTitle className="text-2xl tabular-nums">{fmtUsdg(pos.claimable)}</CardTitle></CardHeader>
          <CardContent>
            <TxButton
              label="Claim USDG"
              variant="outline"
              disabled={!address || !pos.claimable}
              write={() => ({ address: market.pool, abi: lendingPoolAbi, functionName: "claim", args: [address!] })}
              onDone={refresh}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Deposit {ticker}</CardTitle><CardDescription>Wallet balance {fmtToken(pos.walletBalance, ticker)}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <AmountField id="deposit" label="Amount" unit={ticker} value={depositAmount} onChange={setDepositAmount} max={pos.walletBalance !== undefined ? formatUnits(pos.walletBalance, 18) : undefined} />
            <div className="flex justify-end gap-2">
              {needsApproval ? (
                <TxButton label={`Approve ${ticker}`} disabled={!address} write={() => ({ address: market.token, abi: mockStockTokenAbi, functionName: "approve", args: [market.pool, deposit] })} onDone={refresh} />
              ) : (
                <TxButton label="Deposit" disabled={!address || deposit === 0n} write={() => ({ address: market.pool, abi: lendingPoolAbi, functionName: "deposit", args: [deposit, address!] })} onDone={() => { setDepositAmount(""); refresh(); }} />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Withdraw {ticker}</CardTitle><CardDescription>Up to the pool&apos;s idle liquidity: {fmtToken(row?.idle, ticker)} free right now</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <AmountField id="withdraw" label="Amount" unit={ticker} value={withdrawAmount} onChange={setWithdrawAmount} max={pos.maxWithdraw !== undefined ? formatUnits(pos.maxWithdraw, 18) : undefined} />
            <div className="flex justify-end">
              <TxButton label="Withdraw" variant="outline" disabled={!address || withdraw === 0n} write={() => ({ address: market.pool, abi: lendingPoolAbi, functionName: "withdraw", args: [withdraw, address!, address!] })} onDone={() => { setWithdrawAmount(""); refresh(); }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LendPage() {
  return <Suspense><LendInner /></Suspense>;
}
