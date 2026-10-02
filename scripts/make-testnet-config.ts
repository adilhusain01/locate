// Builds contracts/script/config/testnet-markets.json: the mock tickers Locate deploys on testnet (priced from the
// latest mainnet Chainlink prints) and the real faucet Stock Tokens the deployer already holds on Robinhood Chain
// testnet (priced from the mainnet feed when one exists, else from Robinhood's REST quote).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const MOCKS: Array<[string, "A" | "B"]> = [
  ["NVDA", "A"], ["SPY", "A"], ["AAPL", "A"], ["MSFT", "A"], ["GOOGL", "A"], ["META", "A"],
  ["GME", "B"], ["COIN", "B"], ["MSTR", "B"],
];
// faucet tokens on Robinhood Chain testnet (46630), verified on-chain 2026-10-02: beacon proxies over one shared
// implementation, ERC-8056 supported. Seeds are what the deployer wallet holds, split between lending and the pool.
const REAL: Array<{ ticker: string; token: string; lendSeed: string; poolSeed: string }> = [
  { ticker: "AMD", token: "0x71178BAc73cBeb415514eB542a8995b82669778d", lendSeed: "7000000000000000000", poolSeed: "7000000000000000000" },
  { ticker: "AMZN", token: "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02", lendSeed: "7000000000000000000", poolSeed: "7000000000000000000" },
  { ticker: "NFLX", token: "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93", lendSeed: "7000000000000000000", poolSeed: "7000000000000000000" },
  { ticker: "PLTR", token: "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0", lendSeed: "7000000000000000000", poolSeed: "7000000000000000000" },
  { ticker: "TSLA", token: "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E", lendSeed: "6000000000000000000", poolSeed: "6000000000000000000" },
];

type Row = { ticker: string; name: string; feed: null | { answer?: string } };
const registry = JSON.parse(readFileSync("packages/sdk/registry/robinhood-mainnet.json", "utf8")) as { tokens: Row[] };
const byTicker = new Map(registry.tokens.map((t) => [t.ticker, t]));

async function restPrice8(ticker: string): Promise<string> {
  const res = await fetch(`https://api.robinhood.com/rhj/prices/${ticker}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; locate-config/0.1)", accept: "application/json" },
  });
  if (!res.ok) throw new Error(`REST price for ${ticker}: HTTP ${res.status}`);
  const q = ((await res.json()) as { quotes: { tokenBid: string; tokenAsk: string }[] }).quotes[0];
  const mid = (Number(q.tokenBid) + Number(q.tokenAsk)) / 2;
  return Math.round(mid * 1e8).toString();
}

const tickers: string[] = [];
const names: string[] = [];
const prices8: string[] = [];
const tiers: string[] = [];
for (const [ticker, tier] of MOCKS) {
  const row = byTicker.get(ticker);
  if (!row?.feed?.answer) {
    console.warn(`skipping mock ${ticker}: no mainnet feed answer`);
    continue;
  }
  tickers.push(ticker);
  names.push(`${row.name.replace(" • ", " ")} (Locate testnet mock)`);
  prices8.push(row.feed.answer);
  tiers.push(tier);
}

const real = { tickers: [] as string[], tokens: [] as string[], prices8: [] as string[], lendSeed: [] as string[], poolSeed: [] as string[], source: [] as string[] };
for (const r of REAL) {
  const feedAnswer = byTicker.get(r.ticker)?.feed?.answer;
  const price8 = feedAnswer ?? (await restPrice8(r.ticker));
  real.tickers.push(r.ticker);
  real.tokens.push(r.token);
  real.prices8.push(price8);
  real.lendSeed.push(r.lendSeed);
  real.poolSeed.push(r.poolSeed);
  real.source.push(feedAnswer ? "chainlink-mainnet" : "robinhood-rest");
}

mkdirSync("contracts/script/config", { recursive: true });
writeFileSync(
  "contracts/script/config/testnet-markets.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), tickers, names, prices8, tiers, real }, null, 2),
);
console.log(`mocks: ${tickers.join(", ")}`);
console.log(`real: ${real.tickers.map((t, i) => `${t}@${(Number(real.prices8[i]) / 1e8).toFixed(2)} (${real.source[i]})`).join(", ")}`);
