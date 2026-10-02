// Health monitor and hourly accrual poke. Every run: regime and print age per market, mirror lag against mainnet,
// sequencer status, keeper and owner gas, stuck auctions, and a call to Controller.accrue(token) for any market
// whose fee index is more than an hour old (so lenders are credited even on a quiet market). Breaches go to the
// run record and, when RESEND_API_KEY and ALERT_EMAIL are set, to email.
import { formatEther, parseAbi, type Address } from "viem";
import { controllerAbi, markets, mockFeedAbi, oracleRouterAbi } from "@locate/sdk";
import { account, chain, d, mainnet, pub, sleep, wallet } from "./clients.ts";
import { run } from "./runlog.ts";
import { loadState } from "./state.ts";

const INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_SECONDS ?? 300) * 1000;
const ACCRUE_AFTER = 3600n;
const MIN_GAS = 2n * 10n ** 15n; // 0.002 ETH
const USDG_USD_FEED: Address = "0x61B7e5650328764B076A108EFF5fa7282a1B9aD2";
const aggregator = parseAbi(["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"]);
const marketList = markets(chain.id);

async function alert(lines: string[]) {
  if (!lines.length) return;
  console.log(`ALERT\n  ${lines.join("\n  ")}`);
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!key || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: "Locate monitor <monitor@locate.local>", to: [to], subject: `Locate testnet: ${lines.length} alert(s)`, text: lines.join("\n") }),
  }).catch(() => undefined);
}

async function check() {
  await run("monitor", async (fail) => {
    const alerts: string[] = [];
    const now = BigInt(Math.floor(Date.now() / 1000));
    const oracle = await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "oracle" });
    const regimes: Record<string, number> = {};
    let poked = 0;

    for (const m of marketList) {
      try {
        const q = await pub.readContract({ address: oracle, abi: oracleRouterAbi, functionName: "quote", args: [m.token] });
        regimes[m.ticker] = q.regime;
        const age = now - q.updatedAt;
        if (q.regime === 3) alerts.push(`${m.ticker}: Degraded regime, print is ${age}s old`);
        if (age > 3n * 86400n) alerts.push(`${m.ticker}: print older than three days (${age}s)`);
        const market = await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "market", args: [m.token] });
        if (market.totalDebtRaw > 0n && now - BigInt(market.lastAccrual) > ACCRUE_AFTER) {
          const { request } = await pub.simulateContract({ account, address: d.controller, abi: controllerAbi, functionName: "accrue", args: [m.token] });
          const hash = await wallet.writeContract(request);
          await pub.waitForTransactionReceipt({ hash });
          poked++;
        }
      } catch (error) {
        fail({ market: m.ticker }, error);
      }
    }

    // mirror lag: the testnet USDG feed should carry the mainnet print
    try {
      const [, , , mainUpdated] = await mainnet.readContract({ address: USDG_USD_FEED, abi: aggregator, functionName: "latestRoundData" });
      const [, , , testUpdated] = await pub.readContract({ address: d.usdgFeed, abi: mockFeedAbi, functionName: "latestRoundData" });
      if (mainUpdated > testUpdated + 1800n) alerts.push(`price mirror lagging: mainnet USDG print ${mainUpdated - testUpdated}s ahead of testnet`);
    } catch (error) {
      fail("mirror-lag", error);
    }

    const sequencerHealthy = await pub.readContract({ address: oracle, abi: oracleRouterAbi, functionName: "sequencerHealthy" });
    if (!sequencerHealthy) alerts.push("sequencer feed reports unhealthy");

    const keeperGas = await pub.getBalance({ address: account.address });
    if (keeperGas < MIN_GAS) alerts.push(`keeper gas low: ${formatEther(keeperGas)} ETH`);

    const liqState = loadState<{ accounts: string[] }>("liquidator", { accounts: [] });
    let stuckAuctions = 0;
    for (const acc of liqState.accounts) {
      const start = await pub.readContract({ address: d.controller, abi: controllerAbi, functionName: "auctionStartOf", args: [acc as Address] });
      if (start > 0n && now - start > 1800n) {
        stuckAuctions++;
        alerts.push(`auction on ${acc} open for ${now - start}s`);
      }
    }

    await alert(alerts);
    return { markets: marketList.length, regimes, poked, sequencerHealthy, keeperGas: formatEther(keeperGas), stuckAuctions, alerts: alerts.length };
  });
}

const once = process.argv.includes("--once");
await check();
while (!once) {
  await sleep(INTERVAL_MS);
  await check();
}
