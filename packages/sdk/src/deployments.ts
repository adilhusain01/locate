import type { Address } from "viem";
import testnet from "../../../contracts/deployments/46630.json" with { type: "json" };

export type Deployment = {
  chainId: number;
  usdg: Address;
  weth: Address;
  uniswapV3Factory: Address;
  swapRouter: Address;
  liquiditySeeder: Address;
  calendar: Address;
  oracle: Address;
  riskEngine: Address;
  controller: Address;
  shortRouter: Address;
  liquidator: Address;
  sequencerFeed: Address;
  usdgFeed: Address;
  tickers: string[];
  tokens: Address[];
  pools: Address[];
  feeds: Address[];
  uniswapPools: Address[];
  stylusRiskEngine?: Address;
  stylusCalendar?: Address;
  stylusOracleRouter?: Address;
  keeper?: Address;
  deployedBlock?: number;
};

export const deployments: Record<number, Deployment> = {
  46630: testnet as unknown as Deployment,
};

export function deployment(chainId: number): Deployment {
  const d = deployments[chainId];
  if (!d) throw new Error(`no Locate deployment for chain ${chainId}`);
  return d;
}

export type Market = { ticker: string; token: Address; pool: Address; feed: Address; uniswapPool: Address; index: number };

export function markets(chainId: number): Market[] {
  const d = deployment(chainId);
  return d.tickers.map((ticker, index) => ({
    ticker,
    token: d.tokens[index],
    pool: d.pools[index],
    feed: d.feeds[index],
    uniswapPool: d.uniswapPools[index],
    index,
  }));
}

/// Uniswap v3 path for selling `token` into USDG (exactInput) and, read the other way round by exactOutput,
/// for buying it back. Locate seeds every market at the 0.30 percent tier.
export function pathTokenUsdg(token: Address, usdg: Address): `0x${string}` {
  return `0x${token.slice(2)}000bb8${usdg.slice(2)}` as `0x${string}`;
}
