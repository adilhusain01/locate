// Initialises and configures the Stylus calendar and oracle router from contracts/deployments/46630.json, raises
// the Uniswap observation cardinality so TWAPs have history, and grants the keeper rights on every mock feed.
// Idempotent where the contracts expose a getter.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { calendarAbi, feedAbi, poolAbi, routerAbi } from "./stylus-abi.ts";

const RPC = process.env.ROBINHOOD_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";
const chain = { id: 46630, name: "Robinhood Chain Testnet", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } } as const;
const d = JSON.parse(readFileSync("contracts/deployments/46630.json", "utf8"));
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

let nonce = await pub.getTransactionCount({ address: account.address });
async function send(label: string, req: Parameters<typeof wallet.writeContract>[0]) {
  const hash = await wallet.writeContract({ ...req, nonce: nonce++ } as any);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} failed: ${hash}`);
  console.log(`ok  ${label}`);
}

const HOLIDAYS: [number, number, number][] = [
  [2026, 11, 26], [2026, 12, 25], [2027, 1, 1], [2027, 1, 18], [2027, 2, 15], [2027, 3, 26],
  [2027, 5, 31], [2027, 6, 18], [2027, 7, 5], [2027, 9, 6], [2027, 11, 25], [2027, 12, 24],
];
const calendar = d.stylusCalendar as Address;
const router = d.stylusOracleRouter as Address;

// calendar
if ((await pub.readContract({ address: calendar, abi: calendarAbi, functionName: "owner" })) === "0x0000000000000000000000000000000000000000") {
  await send("calendar.initialize", { address: calendar, abi: calendarAbi, functionName: "initialize", args: [account.address] });
} else console.log("skip calendar.initialize (already initialised)");
for (const [y, m, day] of HOLIDAYS) {
  const sessionDay = await pub.readContract({ address: calendar, abi: calendarAbi, functionName: "daysFromCivil", args: [BigInt(y), BigInt(m), BigInt(day)] });
  const set = await pub.readContract({ address: calendar, abi: calendarAbi, functionName: "holiday", args: [sessionDay] });
  if (set) continue;
  await send(`calendar.setHoliday ${y}-${m}-${day}`, { address: calendar, abi: calendarAbi, functionName: "setHoliday", args: [BigInt(y), BigInt(m), BigInt(day), true] });
}

// router
if ((await pub.readContract({ address: router, abi: routerAbi, functionName: "owner" })) === "0x0000000000000000000000000000000000000000") {
  await send("router.initialize", { address: router, abi: routerAbi, functionName: "initialize", args: [calendar, 6, account.address] });
} else console.log("skip router.initialize (already initialised)");
await send("router.setSequencerFeed", { address: router, abi: routerAbi, functionName: "setSequencerFeed", args: [d.sequencerFeed, 3600n] });
await send("router.setUsdgFeed", { address: router, abi: routerAbi, functionName: "setUsdgFeed", args: [d.usdgFeed, 86400n] });
for (let i = 0; i < d.tickers.length; i++) {
  await send(`router.setFeed ${d.tickers[i]}`, { address: router, abi: routerAbi, functionName: "setFeed", args: [d.tokens[i], d.feeds[i], 86400] });
  await send(`router.setTwapPool ${d.tickers[i]}`, { address: router, abi: routerAbi, functionName: "setTwapPool", args: [d.tokens[i], d.uniswapPools[i], 1800] });
  await send(`pool.increaseObservationCardinalityNext ${d.tickers[i]}`, { address: d.uniswapPools[i], abi: poolAbi, functionName: "increaseObservationCardinalityNext", args: [60] });
}

// keeper rights on the mock feeds
const feeds: Address[] = [...d.feeds, d.usdgFeed];
for (const feed of feeds) {
  const current = await pub.readContract({ address: feed, abi: feedAbi, functionName: "keeper" });
  if (current.toLowerCase() === (d.keeper as string).toLowerCase()) continue;
  await send(`feed.setKeeper ${feed}`, { address: feed, abi: feedAbi, functionName: "setKeeper", args: [d.keeper] });
}
console.log("configuration complete");
