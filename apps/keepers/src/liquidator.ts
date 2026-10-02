// Liquidation keeper. Learns accounts from the Controller's Borrowed events, checks every borrower's health each
// tick, and when one is below 1 simulates a flash liquidation through the Liquidator (no capital needed) and sends
// it if the simulated profit clears MIN_PROFIT_USDG. Accounts with no collateral left and debt remaining are
// absorbed. Every tick writes a run record.
import { parseAbiItem, type Address } from "viem";
import { controllerAbi, liquidatorAbi, markets, pathTokenUsdg } from "@locate/sdk";
import { account, chain, d, pub, sleep, wallet, WAD } from "./clients.ts";
import { run } from "./runlog.ts";
import { loadState, saveState } from "./state.ts";

const INTERVAL_MS = Number(process.env.LIQUIDATOR_INTERVAL_SECONDS ?? 10) * 1000;
const MIN_PROFIT = BigInt(process.env.MIN_PROFIT_USDG ?? "500000"); // 0.5 USDG
const CHUNK = 20_000n;
const marketList = markets(chain.id);
const tokenToTicker = new Map(marketList.map((m) => [m.token.toLowerCase(), m.ticker]));

type State = { lastBlock: string; accounts: string[] };
const state = loadState<State>("liquidator", { lastBlock: String(d.deployedBlock ?? 0), accounts: [] });
const accounts = new Set<string>(state.accounts.map((a) => a.toLowerCase()));

async function discover() {
  const latest = await pub.getBlockNumber();
  let from = BigInt(state.lastBlock) + 1n;
  while (from <= latest) {
    const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
    const logs = await pub.getLogs({
      address: d.controller,
      event: parseAbiItem("event Borrowed(address indexed account, address indexed token, address indexed to, uint256 rawAmount)"),
      fromBlock: from,
      toBlock: to,
    });
    for (const log of logs) accounts.add((log.args.account as Address).toLowerCase());
    from = to + 1n;
  }
  state.lastBlock = latest.toString();
  state.accounts = [...accounts];
  saveState("liquidator", state);
}

async function tick() {
  await run("liquidator", async (fail) => {
    await discover();
    let checked = 0;
    let unhealthy = 0;
    let liquidated = 0;
    let absorbed = 0;
    let unprofitable = 0;
    for (const acc of accounts) {
      const address = acc as Address;
      const borrowed = await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "borrowedTokens", args: [address] });
      if (borrowed.length === 0) continue;
      checked++;
      const health = await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "healthFactor", args: [address] });
      if (health >= WAD) continue;
      unhealthy++;
      const collateral = await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "collateralOf", args: [address] });
      if (collateral === 0n) {
        try {
          const { request } = await pub.simulateContract({ account, address: d.controller, abi: controllerAbi, functionName: "absorb", args: [address] });
          const hash = await wallet.writeContract(request);
          await pub.waitForTransactionReceipt({ hash });
          absorbed++;
        } catch (error) {
          fail({ account: address, action: "absorb" }, error);
        }
        continue;
      }
      for (const token of borrowed) {
        const debt = await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "positionOf", args: [address, token] });
        if (debt === 0n) continue;
        const repay = health < 95n * 10n ** 16n ? debt : (debt + 1n) / 2n;
        const path = pathTokenUsdg(token, d.usdg);
        try {
          const { request, result } = await pub.simulateContract({
            account,
            address: d.liquidator,
            abi: liquidatorAbi,
            functionName: "liquidateWithFlash",
            args: [address, token, repay, path, MIN_PROFIT],
          });
          const hash = await wallet.writeContract(request);
          const receipt = await pub.waitForTransactionReceipt({ hash });
          if (receipt.status === "success") {
            liquidated++;
            console.log(`liquidated ${address} ${tokenToTicker.get(token.toLowerCase())} repay=${repay} profit=${result} tx=${hash}`);
          } else fail({ account: address, token, repay }, new Error(`reverted ${hash}`));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("BelowMinProfit")) unprofitable++;
          else fail({ account: address, token, repay }, error);
        }
      }
    }
    return { accounts: accounts.size, checked, unhealthy, liquidated, absorbed, unprofitable, keeper: account.address };
  });
}

const once = process.argv.includes("--once");
await tick();
while (!once) {
  await sleep(INTERVAL_MS);
  await tick();
}
