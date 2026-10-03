"use client";

import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { formatEther } from "viem";
import { toast } from "sonner";
import { BriefcaseIcon, ChevronDownIcon, CopyIcon, DropletIcon, ExternalLinkIcon, LogOutIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chain, privyAppId } from "@/lib/wagmi";
import { shortAddress } from "@/lib/format";
import { useLogin, useLogout, usePrivy } from "@privy-io/react-auth";
import { CopyAddress } from "./copy-address";
import { NetworkCard } from "./network-card";

// The account side of the top bar: positions, copy the address, and a menu on the address itself. Leaving is a
// menu item, never the button's own click, so a stray tap cannot sign anyone out.
function WalletCluster({ address, onLeave, leaveLabel }: { address: `0x${string}`; onLeave: () => void; leaveLabel: string }) {
  const balance = useBalance({ address, query: { refetchInterval: 15_000 } });
  const explorer = chain.blockExplorers?.default.url;
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied", { description: address });
    } catch {
      toast.error("Could not reach the clipboard", { description: address });
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Link href="/app/portfolio" className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}>
        Portfolio
      </Link>
      <CopyAddress address={address} />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" title={address} />}>
          {shortAddress(address)}
          <ChevronDownIcon aria-hidden="true" className="size-4 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="space-y-1">
              <span className="block text-xs font-normal text-muted-foreground">Connected wallet</span>
              <span className="block break-all font-mono text-xs text-foreground">{address}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {balance.data ? `${Number(formatEther(balance.data.value)).toFixed(4)} testnet ETH` : "Reading balance…"}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copy}><CopyIcon aria-hidden="true" />Copy address</DropdownMenuItem>
          {explorer && (
            <DropdownMenuItem render={<a href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" />}>
              <ExternalLinkIcon aria-hidden="true" />View on explorer
            </DropdownMenuItem>
          )}
          <DropdownMenuItem render={<Link href="/app/portfolio" />}><BriefcaseIcon aria-hidden="true" />Portfolio</DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/app/faucet" />}><DropletIcon aria-hidden="true" />Faucet</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onLeave}><LogOutIcon aria-hidden="true" />{leaveLabel}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    <WalletCluster address={address} onLeave={() => logout()} leaveLabel="Sign out" />
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
    <WalletCluster address={address} onLeave={() => disconnect()} leaveLabel="Disconnect" />
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
