// End-to-end smoke on a live deployment with the owner key: mint mock USDG, deposit collateral, approve the
// router, short one share of the first market through Uniswap, read health, cover it, read again. Prints each
// step; exits non-zero if any state check fails. CHAIN_ID selects the deployment.
import { createPublicClient, createWalletClient, formatUnits, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { controllerAbi, mockUsdgAbi, oracleRouterAbi, shortRouterAbi } from "../packages/sdk/src/abis.ts";
import { chainById } from "../packages/sdk/src/chains.ts";
import { deployment, pathTokenUsdg } from "../packages/sdk/src/deployments.ts";

const CHAIN_ID = Number(process.env.CHAIN_ID ?? 46630);
const d = deployment(CHAIN_ID);
const base = chainById(CHAIN_ID);
const RPC = process.env.RPC_URL ?? (CHAIN_ID === 46630 ? process.env.ROBINHOOD_TESTNET_RPC_URL : process.env.ARBITRUM_SEPOLIA_RPC_URL) ?? base.rpcUrls.default.http[0];
const chain = { ...base, rpcUrls: { default: { http: [RPC] } } };
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as Hex);
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

let nonce = await pub.getTransactionCount({ address: account.address });
async function tx(label: string, req: any) {
  const { request } = await pub.simulateContract({ ...req, account });
  const hash = await wallet.writeContract({ ...request, nonce: nonce++ });
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  console.log(`ok  ${label}  ${hash}`);
}
const token = d.tokens[0];
const ticker = d.tickers[0];
const oracle = await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "oracle" });
const quote = await pub.readContract({ address: oracle, abi: oracleRouterAbi, functionName: "quote", args: [token] });
const allowed = await pub.readContract({ address: oracle, abi: oracleRouterAbi, functionName: "borrowAllowed", args: [token] });
console.log(`${ticker} price ${formatUnits(quote.priceWad, 18)} regime ${quote.regime} borrowAllowed ${allowed}`);
if (!allowed) throw new Error("borrowing not allowed right now (regime or pre-open guard); try again later");

const me = account.address;
await tx("usdg.mint 5000", { address: d.usdg, abi: mockUsdgAbi, functionName: "mint", args: [me, parseUnits("5000", 6)] });
await tx("usdg.approve", { address: d.usdg, abi: mockUsdgAbi, functionName: "approve", args: [d.controller, parseUnits("2000", 6)] });
await tx("controller.depositCollateral 2000", { address: d.controller, abi: controllerAbi, functionName: "depositCollateral", args: [parseUnits("2000", 6), me] });
if (!(await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "isOperator", args: [me, d.shortRouter] }))) {
  await tx("controller.setOperator(router)", { address: d.controller, abi: controllerAbi, functionName: "setOperator", args: [d.shortRouter, true] });
}
const raw = parseUnits("1", 18);
const minOut = (raw * quote.priceWad) / 10n ** 18n / 10n ** 12n * 97n / 100n; // 3 percent allowance on small testnet pools
await tx(`shortRouter.short 1 ${ticker}`, { address: d.shortRouter, abi: shortRouterAbi, functionName: "short", args: [token, raw, pathTokenUsdg(token, d.usdg), minOut] });
const [collateral, health, debt] = await Promise.all([
  pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "collateralOf", args: [me] }),
  pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "healthFactor", args: [me] }),
  pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "positionOf", args: [me, token] }),
]);
console.log(`after short: collateral ${formatUnits(collateral, 6)} USDG, debt ${formatUnits(debt, 18)} ${ticker}, health ${formatUnits(health, 18)}`);
if (debt !== raw) throw new Error("debt not recorded");
if (collateral <= parseUnits("2000", 6)) throw new Error("proceeds not credited");
const maxIn = (raw * quote.priceWad) / 10n ** 18n / 10n ** 12n * 103n / 100n;
await tx(`shortRouter.cover 1 ${ticker}`, { address: d.shortRouter, abi: shortRouterAbi, functionName: "cover", args: [token, raw, pathTokenUsdg(token, d.usdg), maxIn] });
const [collateral2, debt2] = await Promise.all([
  pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "collateralOf", args: [me] }),
  pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "positionOf", args: [me, token] }),
]);
console.log(`after cover: collateral ${formatUnits(collateral2, 6)} USDG, debt ${formatUnits(debt2, 18)} ${ticker}, round trip cost ${formatUnits(parseUnits("2000", 6) - collateral2, 6)} USDG`);
if (debt2 !== 0n) throw new Error("debt not cleared");
console.log("smoke passed");
