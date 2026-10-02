import { ponder } from "ponder:registry";
import { account, activity, feeAccrual, lender, market, position } from "ponder:schema";

const id = (event: { transaction: { hash: `0x${string}` }; log: { logIndex: number } }) => `${event.transaction.hash}:${event.log.logIndex}`;

async function touchAccount(context: any, address: `0x${string}`, timestamp: bigint) {
  await context.db
    .insert(account)
    .values({ address, collateralDeposited: 0n, collateralWithdrawn: 0n, feesPaid: 0n, auctionOpenSince: null, firstSeen: timestamp, lastSeen: timestamp })
    .onConflictDoUpdate({ lastSeen: timestamp });
}

async function record(context: any, event: any, kind: string, fields: Partial<typeof activity.$inferInsert>) {
  await context.db.insert(activity).values({
    id: id(event),
    kind,
    account: fields.account!,
    token: fields.token ?? null,
    rawAmount: fields.rawAmount ?? null,
    usdgAmount: fields.usdgAmount ?? null,
    counterparty: fields.counterparty ?? null,
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
    block: event.block.number,
  });
}

// ------------------------------------------------------------------ Controller

ponder.on("Controller:MarketListed", async ({ event, context }) => {
  await context.db.insert(market).values({
    token: event.args.token,
    pool: event.args.pool,
    listedAt: event.block.timestamp,
    feeIndex: 0n,
    totalLenderUsdg: 0n,
    totalInsuranceUsdg: 0n,
    borrowCount: 0,
    liquidationCount: 0,
    borrowPaused: false,
  });
});

ponder.on("Controller:BorrowPauseSet", async ({ event, context }) => {
  await context.db.update(market, { token: event.args.token }).set({ borrowPaused: event.args.paused });
});

ponder.on("Controller:FeesAccrued", async ({ event, context }) => {
  await context.db.insert(feeAccrual).values({
    id: id(event),
    token: event.args.token,
    feeIndex: event.args.feeIndex,
    lenderUsdg: event.args.lenderUsdg,
    insuranceUsdg: event.args.insuranceUsdg,
    timestamp: event.block.timestamp,
    block: event.block.number,
  });
  await context.db.update(market, { token: event.args.token }).set((row: any) => ({
    feeIndex: event.args.feeIndex,
    totalLenderUsdg: row.totalLenderUsdg + event.args.lenderUsdg,
    totalInsuranceUsdg: row.totalInsuranceUsdg + event.args.insuranceUsdg,
  }));
});

ponder.on("Controller:CollateralDeposited", async ({ event, context }) => {
  await touchAccount(context, event.args.account, event.block.timestamp);
  await context.db.update(account, { address: event.args.account }).set((row: any) => ({ collateralDeposited: row.collateralDeposited + event.args.amount }));
  await record(context, event, "deposit", { account: event.args.account, usdgAmount: event.args.amount, counterparty: event.args.from });
});

ponder.on("Controller:CollateralWithdrawn", async ({ event, context }) => {
  await touchAccount(context, event.args.account, event.block.timestamp);
  await context.db.update(account, { address: event.args.account }).set((row: any) => ({ collateralWithdrawn: row.collateralWithdrawn + event.args.amount }));
  await record(context, event, "withdraw", { account: event.args.account, usdgAmount: event.args.amount, counterparty: event.args.to });
});

ponder.on("Controller:FeesSettled", async ({ event, context }) => {
  await touchAccount(context, event.args.account, event.block.timestamp);
  await context.db.update(account, { address: event.args.account }).set((row: any) => ({ feesPaid: row.feesPaid + event.args.paidUsdg }));
});

ponder.on("Controller:Borrowed", async ({ event, context }) => {
  const { account: who, token, rawAmount } = event.args;
  await touchAccount(context, who, event.block.timestamp);
  await context.db
    .insert(position)
    .values({ id: `${who}:${token}`, account: who, token, debtRaw: rawAmount, borrowedRaw: rawAmount, repaidRaw: 0n, liquidatedRaw: 0n, updatedAt: event.block.timestamp })
    .onConflictDoUpdate((row: any) => ({ debtRaw: row.debtRaw + rawAmount, borrowedRaw: row.borrowedRaw + rawAmount, updatedAt: event.block.timestamp }));
  await context.db.update(market, { token }).set((row: any) => ({ borrowCount: row.borrowCount + 1 }));
  await record(context, event, "borrow", { account: who, token, rawAmount, counterparty: event.args.to });
});

ponder.on("Controller:Repaid", async ({ event, context }) => {
  const { account: who, token, rawAmount } = event.args;
  await touchAccount(context, who, event.block.timestamp);
  await context.db.update(position, { id: `${who}:${token}` }).set((row: any) => ({ debtRaw: row.debtRaw - rawAmount, repaidRaw: row.repaidRaw + rawAmount, updatedAt: event.block.timestamp }));
  await record(context, event, "repay", { account: who, token, rawAmount, counterparty: event.args.payer });
});

ponder.on("Controller:AuctionStarted", async ({ event, context }) => {
  await touchAccount(context, event.args.account, event.block.timestamp);
  await context.db.update(account, { address: event.args.account }).set({ auctionOpenSince: event.block.timestamp });
});

ponder.on("Controller:AuctionCleared", async ({ event, context }) => {
  await context.db.update(account, { address: event.args.account }).set({ auctionOpenSince: null });
});

ponder.on("Controller:Liquidated", async ({ event, context }) => {
  const { account: who, token, repayRaw, usdgOut, liquidator } = event.args;
  await touchAccount(context, who, event.block.timestamp);
  await context.db.update(position, { id: `${who}:${token}` }).set((row: any) => ({ debtRaw: row.debtRaw - repayRaw, liquidatedRaw: row.liquidatedRaw + repayRaw, updatedAt: event.block.timestamp }));
  await context.db.update(market, { token }).set((row: any) => ({ liquidationCount: row.liquidationCount + 1 }));
  await record(context, event, "liquidation", { account: who, token, rawAmount: repayRaw, usdgAmount: usdgOut, counterparty: liquidator });
});

ponder.on("Controller:BadDebtAbsorbed", async ({ event, context }) => {
  const { account: who, token, debtRaw, compensationUsdg } = event.args;
  await context.db.update(position, { id: `${who}:${token}` }).set({ debtRaw: 0n, updatedAt: event.block.timestamp });
  await context.db.update(account, { address: who }).set({ auctionOpenSince: null });
  await record(context, event, "absorb", { account: who, token, rawAmount: debtRaw, usdgAmount: compensationUsdg });
});

// ------------------------------------------------------------------ LendingPool (lender side)

ponder.on("LendingPool:Deposit", async ({ event, context }) => {
  const pool = event.log.address;
  const owner = event.args.owner;
  await touchAccount(context, owner, event.block.timestamp);
  await context.db
    .insert(lender)
    .values({ id: `${owner}:${pool}`, account: owner, pool, shares: event.args.shares, depositedRaw: event.args.assets, withdrawnRaw: 0n, claimedUsdg: 0n, updatedAt: event.block.timestamp })
    .onConflictDoUpdate((row: any) => ({ shares: row.shares + event.args.shares, depositedRaw: row.depositedRaw + event.args.assets, updatedAt: event.block.timestamp }));
  await record(context, event, "lend", { account: owner, token: pool, rawAmount: event.args.assets, counterparty: event.args.sender });
});

ponder.on("LendingPool:Withdraw", async ({ event, context }) => {
  const pool = event.log.address;
  const owner = event.args.owner;
  await touchAccount(context, owner, event.block.timestamp);
  await context.db.update(lender, { id: `${owner}:${pool}` }).set((row: any) => ({ shares: row.shares - event.args.shares, withdrawnRaw: row.withdrawnRaw + event.args.assets, updatedAt: event.block.timestamp }));
  await record(context, event, "unlend", { account: owner, token: pool, rawAmount: event.args.assets, counterparty: event.args.receiver });
});

ponder.on("LendingPool:RewardClaimed", async ({ event, context }) => {
  const pool = event.log.address;
  await context.db.update(lender, { id: `${event.args.account}:${pool}` }).set((row: any) => ({ claimedUsdg: row.claimedUsdg + event.args.usdgAmount, updatedAt: event.block.timestamp }));
  await record(context, event, "claim", { account: event.args.account, token: pool, usdgAmount: event.args.usdgAmount, counterparty: event.args.to });
});

ponder.on("LendingPool:FlashLoan", async ({ event, context }) => {
  await record(context, event, "flash", { account: event.args.receiver, token: event.log.address, rawAmount: event.args.rawAmount, usdgAmount: event.args.fee });
});

// ------------------------------------------------------------------ periphery

ponder.on("ShortRouter:Shorted", async ({ event, context }) => {
  await record(context, event, "short", { account: event.args.account, token: event.args.token, rawAmount: event.args.rawAmount, usdgAmount: event.args.usdgProceeds });
});

ponder.on("ShortRouter:Covered", async ({ event, context }) => {
  await record(context, event, "cover", { account: event.args.account, token: event.args.token, rawAmount: event.args.rawAmount, usdgAmount: event.args.usdgSpent });
});

ponder.on("Liquidator:FlashLiquidated", async ({ event, context }) => {
  await record(context, event, "flash-liquidation", { account: event.args.account, token: event.args.token, rawAmount: event.args.repaidRaw, usdgAmount: event.args.profitUsdg, counterparty: event.args.caller });
});
