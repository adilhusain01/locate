"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chain, privyAppId } from "@/lib/wagmi";
import { shortAddress } from "@/lib/format";
import { useLogin, useLogout, usePrivy } from "@privy-io/react-auth";
import { CopyAddress } from "./copy-address";
import { NetworkCard } from "./network-card";

// The account side of the top bar: positions, copy the address, and the address itself (click to leave).
function WalletCluster({ address, onLeave, leaveHint }: { address: string; onLeave: () => void; leaveHint: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link href="/app/portfolio" className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}>
        Portfolio
      </Link>
      <CopyAddress address={address} />
      <Button variant="outline" onClick={onLeave} title={`${address} (${leaveHint})`}>
        {shortAddress(address)}
      </Button>
    </div>
  );
}

function PrivyConnect() {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  if (!ready) return <Button variant="outline" disabled>…</Button>;
  if (!authenticated || !address) return <Button onClick={() => login()}>Sign in</Button>;
  if (chainId !== chain.id) return <Button variant="outline" onClick={() => switchChain({ chainId: chain.id })}>Switch to Robinhood testnet</Button>;
  return (
    <WalletCluster address={address} onLeave={() => logout()} leaveHint="sign out" />
  );
}

function InjectedConnect() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  if (!isConnected || !address) {
    return (
      <Button onClick={() => connect({ connector: connectors[0] })} disabled={isPending || !connectors[0]}>
        Connect wallet
      </Button>
    );
  }
  if (chainId !== chain.id) return <Button variant="outline" onClick={() => switchChain({ chainId: chain.id })}>Switch to Robinhood testnet</Button>;
  return (
    <WalletCluster address={address} onLeave={() => disconnect()} leaveHint="disconnect" />
  );
}

export function ConnectButton() {
  return (
    <div className="flex items-center gap-2">
      <NetworkCard />
      {privyAppId ? <PrivyConnect /> : <InjectedConnect />}
    </div>
  );
}
