// Pulls the canonical Robinhood Stock Token registry and the Chainlink feed list, verifies each token on-chain
// (beacon proxy over the shared Stock implementation, ERC-8056 support, live multiplier) and reads each feed.
// Output: packages/sdk/registry/robinhood-mainnet.json. Read-only against mainnet.
import { writeFileSync, mkdirSync } from "node:fs";
import { createPublicClient, http, parseAbi, getAddress, type Address, type Hex } from "viem";

const RPC = process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const chain = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" as Address } },
} as const;
const client = createPublicClient({ chain, transport: http(RPC, { retryCount: 3, retryDelay: 500 }) });

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const BEACON_SLOT: Hex = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const tokenAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function uiMultiplier() view returns (uint256)",
  "function supportsInterface(bytes4) view returns (bool)",
]);
const beaconAbi = parseAbi(["function implementation() view returns (address)"]);
const feedAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
  "function oraclePaused() view returns (bool)",
]);

type Asset = {
  tokenSymbol: string;
  tokenName: string;
  deployments: { contractAddress: string; chainId: number }[];
  currentMultiplier: string;
  pendingMultiplier: string;
  status: string;
  tradingCapabilities: unknown;
};
type Feed = { name: string; proxyAddress: string; decimals: number; heartbeat: number; threshold: number; feedCategory: string };

const UA = { "user-agent": "Mozilla/5.0 (compatible; locate-registry/0.1)", accept: "application/json" };
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}
const [assetsRaw, feeds] = await Promise.all([
  getJson<unknown>("https://api.robinhood.com/rhj/assets"),
  getJson<Feed[]>("https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json"),
]);
const assets: Asset[] = Array.isArray(assetsRaw)
  ? (assetsRaw as Asset[])
  : ((assetsRaw as any).results ?? (assetsRaw as any).assets ?? (assetsRaw as any).data ?? []);
if (!assets.length) throw new Error(`unexpected registry shape: ${JSON.stringify(assetsRaw).slice(0, 300)}`);

const feedByTicker = new Map<string, Feed>();
for (const f of feeds) {
  const m = f.name.match(/^Robinhood ([A-Z.]+)\s*[\/-]\s*USD$/);
  if (m) feedByTicker.set(m[1], f);
}
const usdgFeed = feeds.find((f) => f.name === "USDG / USD");

const onChain = assets
  .map((a) => ({ a, d: a.deployments.find((d) => d.chainId === 4663) }))
  .filter((x): x is { a: Asset; d: { contractAddress: string; chainId: number } } => Boolean(x.d));

const multicallOk = (await client.getCode({ address: chain.contracts.multicall3.address })) !== undefined;
console.log(`assets ${assets.length}, on Robinhood Chain ${onChain.length}, feeds ${feeds.length}, equity feeds ${feedByTicker.size}, multicall3 ${multicallOk ? "yes" : "no"}`);

const tokenCalls = onChain.flatMap(({ d }) => {
  const address = getAddress(d.contractAddress);
  return [
    { address, abi: tokenAbi, functionName: "symbol" },
    { address, abi: tokenAbi, functionName: "decimals" },
    { address, abi: tokenAbi, functionName: "uiMultiplier" },
    { address, abi: tokenAbi, functionName: "supportsInterface", args: ["0xa60bf13d"] },
  ] as const;
});
const tokenResults = await client.multicall({ contracts: tokenCalls as any, allowFailure: true, batchSize: 1024 });
const beacons = await mapLimit(onChain, 6, ({ d }) =>
  client.getStorageAt({ address: getAddress(d.contractAddress), slot: BEACON_SLOT }),
);
const beaconAddrs = beacons.map((b) => (b && b !== "0x" + "0".repeat(64) ? getAddress("0x" + b.slice(26)) : null));
const uniqueBeacons = [...new Set(beaconAddrs.filter(Boolean) as Address[])];
const impls = await client.multicall({
  contracts: uniqueBeacons.map((address) => ({ address, abi: beaconAbi, functionName: "implementation" })) as any,
  allowFailure: true,
});
const implByBeacon = new Map<Address, Address | null>();
uniqueBeacons.forEach((b, i) => implByBeacon.set(b, impls[i].status === "success" ? (impls[i].result as Address) : null));

const feedList = [...feedByTicker.values()];
const feedResults = await client.multicall({
  contracts: feedList.flatMap((f) => {
    const address = getAddress(f.proxyAddress);
    return [
      { address, abi: feedAbi, functionName: "latestRoundData" },
      { address, abi: feedAbi, functionName: "oraclePaused" },
    ];
  }) as any,
  allowFailure: true,
});
const now = Math.floor(Date.now() / 1000);
const feedState = new Map<string, { address: Address; answer: string; updatedAt: number; ageSeconds: number; paused: boolean | null }>();
feedList.forEach((f, i) => {
  const rd = feedResults[2 * i];
  const paused = feedResults[2 * i + 1];
  if (rd.status === "success") {
    const [, answer, , updatedAt] = rd.result as [bigint, bigint, bigint, bigint, bigint];
    feedState.set(f.name, {
      address: getAddress(f.proxyAddress),
      answer: answer.toString(),
      updatedAt: Number(updatedAt),
      ageSeconds: now - Number(updatedAt),
      paused: paused.status === "success" ? (paused.result as boolean) : null,
    });
  }
});

const rows = onChain.map(({ a, d }, i) => {
  const r = tokenResults.slice(4 * i, 4 * i + 4);
  const beacon = beaconAddrs[i];
  const feed = feedByTicker.get(a.tokenSymbol);
  const fs = feed ? feedState.get(feed.name) : undefined;
  return {
    ticker: a.tokenSymbol,
    name: a.tokenName,
    address: getAddress(d.contractAddress),
    status: a.status,
    symbolOnChain: r[0].status === "success" ? r[0].result : null,
    decimals: r[1].status === "success" ? Number(r[1].result) : null,
    uiMultiplier: r[2].status === "success" ? (r[2].result as bigint).toString() : null,
    registryMultiplier: a.currentMultiplier,
    pendingMultiplier: a.pendingMultiplier || null,
    erc8056: r[3].status === "success" ? r[3].result : null,
    beacon,
    implementation: beacon ? implByBeacon.get(beacon) ?? null : null,
    feed: feed
      ? { address: getAddress(feed.proxyAddress), decimals: feed.decimals, heartbeat: feed.heartbeat, threshold: feed.threshold, ...fs }
      : null,
  };
});

const implCounts = new Map<string, number>();
for (const r of rows) implCounts.set(String(r.implementation), (implCounts.get(String(r.implementation)) ?? 0) + 1);
const canonicalImpl = [...implCounts.entries()].sort((x, y) => y[1] - x[1])[0];
const out = {
  generatedAt: new Date().toISOString(),
  chainId: 4663,
  canonicalImplementation: canonicalImpl?.[0] ?? null,
  implementationCounts: Object.fromEntries(implCounts),
  usdgFeed: usdgFeed ? { address: getAddress(usdgFeed.proxyAddress), ...feedState.get(usdgFeed.name) } : null,
  tokens: rows,
};
mkdirSync("packages/sdk/registry", { recursive: true });
writeFileSync("packages/sdk/registry/robinhood-mainnet.json", JSON.stringify(out, null, 2));

const withFeed = rows.filter((r) => r.feed);
const mismatched = rows.filter((r) => r.uiMultiplier && r.registryMultiplier && BigInt(r.uiMultiplier) !== BigInt(Math.round(Number(r.registryMultiplier) * 1e18)));
console.log(`implementations: ${JSON.stringify(Object.fromEntries(implCounts))}`);
console.log(`tokens with a Chainlink feed: ${withFeed.length}; ERC-8056 supported on-chain: ${rows.filter((r) => r.erc8056 === true).length}`);
console.log(`multiplier disagreements registry vs chain (beyond float rounding): ${mismatched.length}`);
const sample = withFeed.slice(0, 40).map((r) => `${r.ticker.padEnd(6)} ${r.address} feed=${r.feed!.address} answer=${r.feed!.answer} age=${Math.round((r.feed!.ageSeconds ?? 0) / 3600)}h paused=${r.feed!.paused}`);
console.log(sample.join("\n"));
