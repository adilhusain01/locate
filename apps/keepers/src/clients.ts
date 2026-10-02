import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chainById, deployment, robinhoodMainnet } from "@locate/sdk";

/// CHAIN_ID picks the deployment the keepers work on (46630 Robinhood testnet by default, 421614 Arbitrum Sepolia).
export const CHAIN_ID = Number(process.env.CHAIN_ID ?? 46630);
const base = chainById(CHAIN_ID);
const RPC =
  process.env.RPC_URL ??
  (CHAIN_ID === 46630 ? process.env.ROBINHOOD_TESTNET_RPC_URL : process.env.ARBITRUM_SEPOLIA_RPC_URL) ??
  base.rpcUrls.default.http[0];
export const chain = { ...base, rpcUrls: { default: { http: [RPC] } } };
export const d = deployment(CHAIN_ID);
export const pub = createPublicClient({ chain, transport: http(RPC, { retryCount: 3 }) });
export const mainnet = createPublicClient({
  chain: robinhoodMainnet,
  transport: http(process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com"),
});

const key = (process.env.KEEPER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY) as Hex | undefined;
if (!key) throw new Error("KEEPER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) is not set");
export const account = privateKeyToAccount(key);
export const wallet = createWalletClient({ account, chain, transport: http(RPC) });

export const WAD = 10n ** 18n;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
