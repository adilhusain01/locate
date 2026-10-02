"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { chain, privyAppId } from "@/lib/wagmi";
import { shortAddress } from "@/lib/format";
import { useLogin, useLogout, usePrivy } from "@privy-io/react-auth";

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
    <Button variant="outline" onClick={() => logout()} title={address}>
      {shortAddress(address)}
    </Button>
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
    <Button variant="outline" onClick={() => disconnect()} title={address}>
      {shortAddress(address)}
    </Button>
  );
}

export function ConnectButton() {
  return privyAppId ? <PrivyConnect /> : <InjectedConnect />;
}
