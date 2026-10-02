// Differential check between the Solidity reference contracts and the Stylus ones on the live testnet:
// RiskMathRef vs risk-engine on fixed and random inputs, OracleRouter v0 vs the Stylus router on every market.
// Exits non-zero on any mismatch. With --switch, points the Controller at the Stylus engine and router after a
// clean run.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { controllerAbi, engineAbi, routerAbi, solidityRouterAbi } from "./stylus-abi.ts";

const RPC = process.env.ROBINHOOD_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";
const chain = { id: 46630, name: "Robinhood Chain Testnet", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } } as const;
const d = JSON.parse(readFileSync("contracts/deployments/46630.json", "utf8"));
const pub = createPublicClient({ chain, transport: http(RPC) });
const WAD = 10n ** 18n;
let mismatches = 0;
const same = (label: string, a: unknown, b: unknown) => {
  const eq = JSON.stringify(a, (_, v) => (typeof v === "bigint" ? v.toString() : v)) === JSON.stringify(b, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  if (!eq) mismatches++;
  console.log(`${eq ? "same" : "DIFF"} ${label}${eq ? "" : `: solidity=${JSON.stringify(a, (_, v) => (typeof v === "bigint" ? v.toString() : v))} stylus=${JSON.stringify(b, (_, v) => (typeof v === "bigint" ? v.toString() : v))}`}`);
};

// deterministic pseudo-random inputs so a failure can be replayed
let seed = 20261002n;
const rnd = (max: bigint) => { seed = (seed * 6364136223846793005n + 1442695040888963407n) % (1n << 64n); return seed % max; };

const engines = { solidity: d.riskEngine as Address, stylus: d.stylusRiskEngine as Address };
const irm = { baseWad: 10n ** 16n, kinkWad: 8n * 10n ** 17n, rateAtKinkWad: 10n ** 17n, maxRateWad: 15n * 10n ** 17n };
for (let i = 0; i < 40; i++) {
  const n = Number(rnd(4n)) + 1;
  const positions = Array.from({ length: n }, () => ({
    debtRaw: rnd(10n ** 24n) + 1n,
    priceWad: rnd(10n ** 22n) + 1n,
    liqThresholdWad: WAD + rnd(WAD),
    initialRatioWad: 2n * WAD + rnd(WAD),
  }));
  const collateral = rnd(10n ** 30n);
  const [a, b] = await Promise.all(
    (["solidity", "stylus"] as const).map((k) => pub.readContract({ address: engines[k], abi: engineAbi, functionName: "evaluate", args: [positions, collateral] })),
  );
  same(`evaluate #${i} (${n} positions)`, a, b);
}
for (const u of [0n, 10n ** 17n, 4n * 10n ** 17n, 8n * 10n ** 17n, 9n * 10n ** 17n, WAD, 2n * WAD, rnd(WAD), rnd(WAD)]) {
  const [a, b] = await Promise.all((["solidity", "stylus"] as const).map((k) => pub.readContract({ address: engines[k], abi: engineAbi, functionName: "borrowRate", args: [u, irm] })));
  same(`borrowRate u=${u}`, a, b);
}
for (const t of [0n, 300n, 600n, 1200n, 999999n, rnd(2000n)]) {
  const [a, b] = await Promise.all((["solidity", "stylus"] as const).map((k) => pub.readContract({ address: engines[k], abi: engineAbi, functionName: "dutchDiscount", args: [t, 10n ** 16n, 12n * 10n ** 16n, 1200n] })));
  same(`dutchDiscount t=${t}`, a, b);
}

// routers: the Stylus router may price higher (pool leg); regime and updatedAt must match, price within the band
for (let i = 0; i < d.tickers.length; i++) {
  const sol = await pub.readContract({ address: d.oracle, abi: solidityRouterAbi, functionName: "quote", args: [d.tokens[i]] });
  const [price, regime, updatedAt] = await pub.readContract({ address: d.stylusOracleRouter, abi: routerAbi, functionName: "quote", args: [d.tokens[i]] });
  const twap = await pub.readContract({ address: d.stylusOracleRouter, abi: routerAbi, functionName: "twapPriceWad", args: [d.tokens[i]] });
  const ratio = Number(price * 10000n / sol.priceWad) / 10000;
  const ok = regime === sol.regime && updatedAt === sol.updatedAt && price >= sol.priceWad && ratio <= 1.1;
  if (!ok) mismatches++;
  console.log(`${ok ? "ok  " : "DIFF"} ${d.tickers[i].padEnd(5)} print=${(Number(sol.priceWad) / 1e18).toFixed(2)} stylus=${(Number(price) / 1e18).toFixed(2)} twap=${(Number(twap) / 1e18).toFixed(2)} regime sol=${sol.regime} stylus=${regime}`);
}
const [solAllowed, styAllowed, solUsdg, styUsdg] = await Promise.all([
  pub.readContract({ address: d.oracle, abi: solidityRouterAbi, functionName: "borrowAllowed", args: [d.tokens[0]] }),
  pub.readContract({ address: d.stylusOracleRouter, abi: routerAbi, functionName: "borrowAllowed", args: [d.tokens[0]] }),
  pub.readContract({ address: d.oracle, abi: solidityRouterAbi, functionName: "usdgPriceWad" }),
  pub.readContract({ address: d.stylusOracleRouter, abi: routerAbi, functionName: "usdgPriceWad" }),
]);
same("borrowAllowed", solAllowed, styAllowed);
same("usdgPriceWad", solUsdg, styUsdg);

console.log(mismatches === 0 ? "differential check clean" : `differential check: ${mismatches} mismatches`);
if (mismatches > 0) process.exit(1);

if (process.argv.includes("--switch")) {
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
  const wallet = createWalletClient({ account, chain, transport: http(RPC) });
  let nonce = await pub.getTransactionCount({ address: account.address });
  for (const [fn, target] of [["setRiskEngine", d.stylusRiskEngine], ["setOracle", d.stylusOracleRouter]] as const) {
    const hash = await wallet.writeContract({ address: d.controller, abi: controllerAbi, functionName: fn, args: [target], nonce: nonce++ });
    const r = await pub.waitForTransactionReceipt({ hash });
    console.log(`${fn} -> ${target}: ${r.status}`);
  }
  console.log("controller now on", await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "riskEngine" }), await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "oracle" }));
}
