// Price mirror: copies the mainnet Chainlink prints (answer and updatedAt) for every listed testnet market into
// that market's MockFeed, so staleness and the 24/5 schedule behave on testnet exactly as on mainnet. Tokens
// without a mainnet feed (NFLX) take Robinhood's REST mid with the current time as updatedAt. Also mirrors the
// USDG/USD feed. Runs every MIRROR_INTERVAL_SECONDS (default 300) unless started with --once.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodMainnet, robinhoodTestnet } from "./chains.ts";
import { run } from "./runlog.ts";

const DEPLOYMENTS = process.env.DEPLOYMENTS_FILE ?? new URL("../../../contracts/deployments/46630.json", import.meta.url).pathname;
const REGISTRY = process.env.REGISTRY_FILE ?? new URL("../../../packages/sdk/registry/robinhood-mainnet.json", import.meta.url).pathname;
const USDG_USD_FEED: Address = "0x61B7e5650328764B076A108EFF5fa7282a1B9aD2";
const INTERVAL = Number(process.env.MIRROR_INTERVAL_SECONDS ?? 300);

const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  "function setAnswer(int256 answer, uint256 updatedAt)",
]);

type Deployment = { tickers: string[]; feeds: Address[]; usdgFeed: Address };
type Registry = { tokens: { ticker: string; feed: null | { address: Address } }[] };

const key = process.env.KEEPER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
if (!key) throw new Error("KEEPER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) is not set");
const account = privateKeyToAccount(key as Hex);
const mainnet = createPublicClient({ chain: robinhoodMainnet, transport: http() });
const testnet = createPublicClient({ chain: robinhoodTestnet, transport: http() });
const wallet = createWalletClient({ account, chain: robinhoodTestnet, transport: http() });

async function restMid(ticker: string): Promise<bigint> {
  const res = await fetch(`https://api.robinhood.com/rhj/prices/${ticker}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; locate-mirror/0.1)", accept: "application/json" },
  });
  if (!res.ok) throw new Error(`REST ${ticker}: HTTP ${res.status}`);
  const q = ((await res.json()) as { quotes: { tokenBid: string; tokenAsk: string }[] }).quotes[0];
  return BigInt(Math.round(((Number(q.tokenBid) + Number(q.tokenAsk)) / 2) * 1e8));
}

async function mirrorOnce() {
  await run("price-mirror", async (fail) => {
    const deployment = JSON.parse(readFileSync(DEPLOYMENTS, "utf8")) as Deployment;
    const registry = JSON.parse(readFileSync(REGISTRY, "utf8")) as Registry;
    const mainnetFeed = new Map(registry.tokens.filter((t) => t.feed).map((t) => [t.ticker, t.feed!.address]));

    const targets: { ticker: string; testnetFeed: Address; source: Address | "rest" }[] = deployment.tickers.map((ticker, i) => ({
      ticker,
      testnetFeed: deployment.feeds[i],
      source: mainnetFeed.get(ticker) ?? "rest",
    }));
    targets.push({ ticker: "USDG", testnetFeed: deployment.usdgFeed, source: USDG_USD_FEED });

    const sourced = await Promise.all(
      targets.map(async (t) => {
        try {
          if (t.source === "rest") {
            return { ...t, answer: await restMid(t.ticker), updatedAt: BigInt(Math.floor(Date.now() / 1000)) };
          }
          const [, answer, , updatedAt] = await mainnet.readContract({ address: t.source, abi: feedAbi, functionName: "latestRoundData" });
          return { ...t, answer, updatedAt };
        } catch (error) {
          fail(t, error);
          return null;
        }
      }),
    );

    let written = 0;
    let unchanged = 0;
    let nonce = await testnet.getTransactionCount({ address: account.address });
    for (const t of sourced) {
      if (!t) continue;
      try {
        const [, current, , currentUpdatedAt] = await testnet.readContract({ address: t.testnetFeed, abi: feedAbi, functionName: "latestRoundData" });
        if (current === t.answer && currentUpdatedAt === t.updatedAt) {
          unchanged++;
          continue;
        }
        const hash = await wallet.writeContract({
          address: t.testnetFeed,
          abi: feedAbi,
          functionName: "setAnswer",
          args: [t.answer, t.updatedAt],
          nonce: nonce++,
        });
        await testnet.waitForTransactionReceipt({ hash });
        written++;
      } catch (error) {
        fail(t, error);
      }
    }
    return { markets: targets.length, written, unchanged, keeper: account.address };
  });
}

const once = process.argv.includes("--once");
await mirrorOnce();
if (!once) {
  setInterval(() => void mirrorOnce(), INTERVAL * 1000);
}
