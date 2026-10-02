"use client";

import { useAccount } from "wagmi";
import { lendingPoolAbi } from "@locate/sdk/abis";
import type { Market } from "@locate/sdk/deployments";
import { TableCell, TableRow } from "@/components/ui/table";
import { TxButton } from "@/components/tx-button";
import { fmtToken, fmtUsdg } from "@/lib/format";
import { useLenderPosition } from "@/lib/locate";

export function LenderRow({ market }: { market: Market }) {
  const { address } = useAccount();
  const pos = useLenderPosition(market);
  if (!pos.shares || pos.shares === 0n) return null;
  return (
    <TableRow>
      <TableCell className="font-medium">{market.ticker}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtToken(pos.maxWithdraw, market.ticker)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtToken(pos.effectiveShares)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtUsdg(pos.claimable)}</TableCell>
      <TableCell className="text-right">
        <TxButton label="Claim" variant="outline" disabled={!address || !pos.claimable} write={() => ({ address: market.pool, abi: lendingPoolAbi, functionName: "claim", args: [address!] })} onDone={() => pos.refetch()} />
      </TableCell>
    </TableRow>
  );
}
