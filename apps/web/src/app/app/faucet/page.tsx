"use client";

import { useAccount } from "wagmi";
import { mockStockTokenAbi, mockUsdgAbi } from "@locate/sdk/abis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TxButton } from "@/components/tx-button";
import { d, markets, REAL_TICKERS, useMyAccount } from "@/lib/locate";
import { fmtUsdg } from "@/lib/format";
import { GasDrip } from "@/components/gas-drip";

export default function FaucetPage() {
  const { address } = useAccount();
  const me = useMyAccount();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Faucet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Testnet only. Mock USDG and the mock stock tokens mint once a day per address. The faucet tokens come from Robinhood&apos;s own faucet.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-3">
          <CardHeader><CardTitle className="text-base">Start here: gas</CardTitle><CardDescription>A fresh wallet has no testnet ETH, so its first transaction cannot be paid for. Take a drip here, or use Robinhood&apos;s faucet for more.</CardDescription></CardHeader>
          <CardContent><GasDrip /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">USDG (mock)</CardTitle><CardDescription>1,000 USDG per claim. You hold {fmtUsdg(me.usdgBalance)}.</CardDescription></CardHeader>
          <CardContent><TxButton label="Claim 1,000 USDG" disabled={!address} write={() => ({ address: d.usdg, abi: mockUsdgAbi, functionName: "faucet" })} onDone={() => me.refetch()} /></CardContent>
        </Card>
        {markets.filter((m) => !REAL_TICKERS.has(m.ticker)).map((m) => (
          <Card key={m.token}>
            <CardHeader><CardTitle className="text-base">{m.ticker} (mock)</CardTitle><CardDescription>1,000 tokens per claim, priced from the mainnet feed.</CardDescription></CardHeader>
            <CardContent><TxButton label={`Claim 1,000 ${m.ticker}`} variant="outline" disabled={!address} write={() => ({ address: m.token, abi: mockStockTokenAbi, functionName: "faucet" })} /></CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader><CardTitle className="text-base">AMD, AMZN, NFLX, PLTR, TSLA</CardTitle><CardDescription>Real Robinhood testnet Stock Tokens. Get them and testnet ETH from Robinhood&apos;s faucet.</CardDescription></CardHeader>
          <CardContent><a className="text-sm underline underline-offset-4" href="https://faucet.testnet.chain.robinhood.com/" target="_blank" rel="noreferrer">faucet.testnet.chain.robinhood.com</a></CardContent>
        </Card>
      </div>
    </div>
  );
}
