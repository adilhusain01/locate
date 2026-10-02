"use client";

import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import { controllerAbi, lendingPoolAbi, mockStockTokenAbi, oracleRouterAbi, riskMathRefAbi } from "@locate/sdk/abis";
import { deployment, markets as marketList, type Market } from "@locate/sdk/deployments";
import { chain } from "./wagmi";
import { WAD } from "./format";

export const d = deployment(chain.id);
export const markets = marketList(chain.id);
export const REAL_TICKERS = new Set(["AMD", "AMZN", "NFLX", "PLTR", "TSLA"]);

export type MarketRow = Market & {
  priceWad: bigint;
  regime: number;
  updatedAt: bigint;
  totalAssets: bigint;
  totalBorrows: bigint;
  idle: bigint;
  utilisation: bigint;
  borrowRateWad: bigint;
  supplyRateWad: bigint;
  uiMultiplier: bigint;
  borrowCap: bigint;
  borrowPaused: boolean;
  initialRatioWad: bigint;
  liqThresholdWad: bigint;
};

/// One multicall for the whole markets table, refreshed every 15 seconds.
export function useMarkets() {
  const contracts = markets.flatMap((m) => [
    { address: d.controller, abi: controllerAbi, functionName: "market", args: [m.token] } as const,
    { address: m.pool, abi: lendingPoolAbi, functionName: "totalAssets" } as const,
    { address: m.pool, abi: lendingPoolAbi, functionName: "totalBorrows" } as const,
    { address: m.pool, abi: lendingPoolAbi, functionName: "idle" } as const,
    { address: m.pool, abi: lendingPoolAbi, functionName: "utilisation" } as const,
    { address: m.token, abi: mockStockTokenAbi, functionName: "uiMultiplier" } as const,
  ]);
  const oracleAddress = useReadContract({ address: d.controller, abi: controllerAbi, functionName: "oracle" });
  const engineAddress = useReadContract({ address: d.controller, abi: controllerAbi, functionName: "riskEngine" });
  const base = useReadContracts({ contracts, allowFailure: false, query: { refetchInterval: 15_000 } });
  const quotes = useReadContracts({
    contracts: markets.map((m) => ({ address: oracleAddress.data as Address, abi: oracleRouterAbi, functionName: "quote", args: [m.token] }) as const),
    allowFailure: true,
    query: { enabled: Boolean(oracleAddress.data), refetchInterval: 15_000 },
  });
  const rates = useReadContracts({
    contracts: markets.map((m, i) => {
      const market = base.data?.[i * 6] as any;
      return {
        address: engineAddress.data as Address,
        abi: riskMathRefAbi,
        functionName: "borrowRate",
        args: [(base.data?.[i * 6 + 4] as bigint) ?? 0n, market?.params?.irm ?? { baseWad: 0n, kinkWad: 1n, rateAtKinkWad: 0n, maxRateWad: 0n }],
      } as const;
    }),
    allowFailure: true,
    query: { enabled: Boolean(engineAddress.data && base.data), refetchInterval: 15_000 },
  });

  const rows = useMemo<MarketRow[] | undefined>(() => {
    if (!base.data) return undefined;
    return markets.map((m, i) => {
      const market = base.data[i * 6] as any;
      const totalAssets = base.data[i * 6 + 1] as bigint;
      const totalBorrows = base.data[i * 6 + 2] as bigint;
      const idle = base.data[i * 6 + 3] as bigint;
      const utilisation = base.data[i * 6 + 4] as bigint;
      const uiMultiplier = base.data[i * 6 + 5] as bigint;
      const q = quotes.data?.[i]?.status === "success" ? (quotes.data[i].result as any) : undefined;
      const borrowRateWad = rates.data?.[i]?.status === "success" ? (rates.data[i].result as bigint) : 0n;
      const supplyRateWad = (borrowRateWad * utilisation * 9000n) / (WAD * 10000n);
      return {
        ...m,
        priceWad: q?.priceWad ?? 0n,
        regime: Number(q?.regime ?? 2),
        updatedAt: q?.updatedAt ?? 0n,
        totalAssets,
        totalBorrows,
        idle,
        utilisation,
        borrowRateWad,
        supplyRateWad,
        uiMultiplier,
        borrowCap: market.params.borrowCapRaw as bigint,
        borrowPaused: market.borrowPaused as boolean,
        initialRatioWad: market.params.initialRatioWad as bigint,
        liqThresholdWad: market.params.liqThresholdWad as bigint,
      };
    });
  }, [base.data, quotes.data, rates.data]);

  return { rows, isLoading: base.isLoading, error: base.error ?? quotes.error ?? rates.error, refetch: () => { base.refetch(); quotes.refetch(); rates.refetch(); } };
}

export function useMyAccount() {
  const { address } = useAccount();
  const enabled = Boolean(address);
  const reads = useReadContracts({
    contracts: [
      { address: d.controller, abi: controllerAbi, functionName: "collateralOf", args: [address!] },
      { address: d.controller, abi: controllerAbi, functionName: "pendingFees", args: [address!] },
      { address: d.controller, abi: controllerAbi, functionName: "healthFactor", args: [address!] },
      { address: d.controller, abi: controllerAbi, functionName: "borrowedTokens", args: [address!] },
      { address: d.controller, abi: controllerAbi, functionName: "auctionStartOf", args: [address!] },
      { address: d.controller, abi: controllerAbi, functionName: "isOperator", args: [address!, d.shortRouter] },
      { address: d.usdg, abi: mockStockTokenAbi, functionName: "balanceOf", args: [address!] },
      { address: d.usdg, abi: mockStockTokenAbi, functionName: "allowance", args: [address!, d.controller] },
    ] as const,
    allowFailure: false,
    query: { enabled, refetchInterval: 10_000 },
  });
  const positions = useReadContracts({
    contracts: markets.map((m) => ({ address: d.controller, abi: controllerAbi, functionName: "positionOf", args: [address!, m.token] }) as const),
    allowFailure: false,
    query: { enabled, refetchInterval: 10_000 },
  });
  const data = reads.data;
  return {
    address,
    collateral: data?.[0],
    pendingFees: data?.[1],
    health: data?.[2],
    borrowedTokens: data?.[3] as readonly Address[] | undefined,
    auctionStart: data?.[4],
    routerApproved: data?.[5],
    usdgBalance: data?.[6],
    usdgAllowance: data?.[7],
    positions: positions.data as readonly bigint[] | undefined,
    isLoading: reads.isLoading,
    refetch: () => { reads.refetch(); positions.refetch(); },
  };
}

export function useLenderPosition(market: Market | undefined) {
  const { address } = useAccount();
  const enabled = Boolean(address && market);
  const reads = useReadContracts({
    contracts: market
      ? ([
          { address: market.pool, abi: lendingPoolAbi, functionName: "balanceOf", args: [address!] },
          { address: market.pool, abi: lendingPoolAbi, functionName: "maxWithdraw", args: [address!] },
          { address: market.pool, abi: lendingPoolAbi, functionName: "claimable", args: [address!] },
          { address: market.token, abi: mockStockTokenAbi, functionName: "balanceOf", args: [address!] },
          { address: market.token, abi: mockStockTokenAbi, functionName: "allowance", args: [address!, market.pool] },
          { address: market.pool, abi: lendingPoolAbi, functionName: "balanceOfUI", args: [address!] },
          { address: market.token, abi: mockStockTokenAbi, functionName: "allowance", args: [address!, d.controller] },
        ] as const)
      : [],
    allowFailure: false,
    query: { enabled, refetchInterval: 10_000 },
  });
  const data = reads.data;
  return {
    shares: data?.[0],
    maxWithdraw: data?.[1],
    claimable: data?.[2],
    walletBalance: data?.[3],
    poolAllowance: data?.[4],
    effectiveShares: data?.[5],
    controllerAllowance: data?.[6],
    refetch: reads.refetch,
  };
}
