"use client";

import { CircleHelpIcon } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CopyValue } from "@/components/copy-address";
import { chain } from "@/lib/wagmi";
import { d } from "@/lib/locate";
import { shortAddress } from "@/lib/format";

const RPC = chain.rpcUrls.default.http[0];
const EXPLORER = chain.blockExplorers?.default.url ?? "https://explorer.testnet.chain.robinhood.com";
const FAUCET = "https://faucet.testnet.chain.robinhood.com/";
const ADDRESSES = "https://github.com/adilhusain01/locate/blob/main/docs/deployments.md";

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center sm:grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-1.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{term}</dt>
      <dd className="flex min-w-0 items-center justify-between gap-2">{children}</dd>
    </div>
  );
}

function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="truncate underline underline-offset-4" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

// The "?" next to the wallet button: everything a wallet needs to reach the network Locate runs on.
export function NetworkCard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const onChain = isConnected && chainId === chain.id;
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="icon" aria-label="About Robinhood Chain testnet" title="Network details" />}>
        <CircleHelpIcon aria-hidden="true" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Robinhood Chain testnet</DialogTitle>
          <DialogDescription>
            Locate runs on Robinhood&apos;s Arbitrum Orbit testnet. Sign in with an email and Privy makes a wallet on it for you; with your own wallet, add the network with these settings.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y font-mono text-[0.8rem]">
          <Row term="Network">{chain.name}</Row>
          <Row term="Chain id">
            <span>{chain.id}</span>
            <CopyValue value={String(chain.id)} what="Chain id" size="icon-sm" />
          </Row>
          <Row term="Currency">{chain.nativeCurrency.symbol} (testnet, no value)</Row>
          <Row term="RPC URL">
            <span className="truncate">{RPC}</span>
            <CopyValue value={RPC} what="RPC URL" size="icon-sm" />
          </Row>
          <Row term="Explorer"><Out href={EXPLORER}>{EXPLORER.replace("https://", "")}</Out></Row>
          <Row term="Faucet"><Out href={FAUCET}>{FAUCET.replace("https://", "").replace(/\/$/, "")}</Out></Row>
          <Row term="Controller">
            <Out href={`${EXPLORER}/address/${d.controller}`}>{shortAddress(d.controller)}</Out>
            <CopyValue value={d.controller} what="Controller address" size="icon-sm" />
          </Row>
          <Row term="Mock USDG">
            <Out href={`${EXPLORER}/address/${d.usdg}`}>{shortAddress(d.usdg)}</Out>
            <CopyValue value={d.usdg} what="USDG address" size="icon-sm" />
          </Row>
          <Row term="Every address"><Out href={ADDRESSES}>docs/deployments.md on GitHub</Out></Row>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {onChain ? "Your wallet is on this network." : isConnected ? "Your wallet is on another network." : "Connect a wallet to add the network in one click."}
          </p>
          {isConnected && !onChain && (
            <Button className="key" onClick={() => switchChain({ chainId: chain.id })} disabled={isPending}>
              {isPending ? "Waiting for the wallet…" : "Add to wallet"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
