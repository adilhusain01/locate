import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deployment, robinhoodMainnet, robinhoodTestnet } from "@locate/sdk";

const RPC = process.env.ROBINHOOD_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";
export const chain = { ...robinhoodTestnet, rpcUrls: { default: { http: [RPC] } } };
export const d = deployment(46630);
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
