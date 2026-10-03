"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAccount, useBalance } from "wagmi";
import { formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { CopyAddress } from "@/components/copy-address";

export function GasDrip() {
  const { address } = useAccount();
  const balance = useBalance({ address, query: { enabled: Boolean(address), refetchInterval: 10_000 } });
  const [busy, setBusy] = useState(false);
  const low = balance.data ? balance.data.value < 1_500_000_000_000_000n : false;

  async function drip() {
    if (!address) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: address }) });
      const json = (await res.json()) as { hash?: string; amount?: string; error?: string };
      if (!res.ok) toast.error(json.error ?? "Gas drip failed");
      else {
        toast.success(`Sent ${json.amount} ETH for gas`);
        setTimeout(() => balance.refetch(), 3000);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Your wallet holds {balance.data ? `${Number(formatEther(balance.data.value)).toFixed(4)} ETH` : "…"} on Robinhood Chain testnet.
        {low && " Every transaction needs a little testnet ETH for gas."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="key" onClick={drip} disabled={!address || busy}>
          {busy ? "Sending…" : "Get 0.002 testnet ETH for gas"}
        </Button>
        {address && <CopyAddress address={address} label="Copy my address" />}
      </div>
      <p className="text-sm text-muted-foreground">
        Need more, or the drip is empty? Robinhood runs its own testnet faucet:{" "}
        <a className="text-foreground underline underline-offset-4" href="https://faucet.testnet.chain.robinhood.com/" target="_blank" rel="noreferrer">
          faucet.testnet.chain.robinhood.com
        </a>
        . Paste your address there to claim ETH, and the AMD, AMZN, NFLX, PLTR and TSLA Stock Tokens with it.
      </p>
    </div>
  );
}
