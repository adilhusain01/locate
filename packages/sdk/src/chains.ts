import { defineChain } from "viem";
import { arbitrumSepolia as viemArbitrumSepolia } from "viem/chains";

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://explorer.testnet.chain.robinhood.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export const robinhoodMainnet = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const arbitrumSepolia = viemArbitrumSepolia;

/// Chains Locate is deployed on, by id.
export const supportedChains = { [robinhoodTestnet.id]: robinhoodTestnet, [arbitrumSepolia.id]: arbitrumSepolia } as const;

export function chainById(id: number) {
  const chain = (supportedChains as Record<number, typeof robinhoodTestnet | typeof arbitrumSepolia>)[id];
  if (!chain) throw new Error(`unsupported chain ${id}`);
  return chain;
}
