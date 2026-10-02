// Builds contracts/script/config/testnet-markets.json from the pulled mainnet registry: the tickers Locate lists
// on testnet, their latest mainnet Chainlink prices (8 decimals) and the risk tier of each.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const TIER_A = ["NVDA", "SPY", "AAPL", "MSFT", "TSLA", "AMZN", "GOOGL", "META"];
const TIER_B = ["GME", "COIN", "PLTR", "MSTR"];

type Row = { ticker: string; name: string; feed: null | { answer?: string } };
const registry = JSON.parse(readFileSync("packages/sdk/registry/robinhood-mainnet.json", "utf8")) as { tokens: Row[] };
const byTicker = new Map(registry.tokens.map((t) => [t.ticker, t]));

const tickers: string[] = [];
const names: string[] = [];
const prices8: string[] = [];
const tiers: string[] = [];
for (const [tier, list] of [["A", TIER_A], ["B", TIER_B]] as const) {
  for (const ticker of list) {
    const row = byTicker.get(ticker);
    if (!row?.feed?.answer) {
      console.warn(`skipping ${ticker}: no mainnet feed answer`);
      continue;
    }
    tickers.push(ticker);
    names.push(`${row.name.replace(" • ", " ")} (Locate testnet mock)`);
    prices8.push(row.feed.answer);
    tiers.push(tier);
  }
}
mkdirSync("contracts/script/config", { recursive: true });
writeFileSync(
  "contracts/script/config/testnet-markets.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), tickers, names, prices8, tiers }, null, 2),
);
console.log(`wrote ${tickers.length} markets: ${tickers.join(", ")}`);
