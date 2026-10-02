"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { robinhoodTestnet } from "@locate/sdk/chains";

const rpc = process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";
const readOnly = createConfig({ chains: [robinhoodTestnet], transports: { [robinhoodTestnet.id]: http(rpc) }, ssr: true });

/// Read-only wagmi for the landing page's live numbers: no wallet, no Privy, just the public RPC.
export function LandingProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } }));
  return (
    <WagmiProvider config={readOnly}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
