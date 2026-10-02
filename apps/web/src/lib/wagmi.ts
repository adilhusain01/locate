import { http } from "wagmi";
import { createConfig as createWagmiConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { createConfig as createPrivyWagmiConfig } from "@privy-io/wagmi";
import { robinhoodTestnet } from "@locate/sdk/chains";

export const chain = robinhoodTestnet;
export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const rpc = process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";

/// With a Privy app id the embedded wallets and external wallets both come through Privy; without one the app
/// falls back to injected wallets only, so it still works on a bare clone.
export const wagmiConfig = privyAppId
  ? createPrivyWagmiConfig({ chains: [chain], transports: { [chain.id]: http(rpc) }, ssr: true })
  : createWagmiConfig({ chains: [chain], connectors: [injected()], transports: { [chain.id]: http(rpc) }, ssr: true });
