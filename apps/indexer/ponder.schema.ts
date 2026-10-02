import { index, onchainTable, relations } from "ponder";

export const market = onchainTable("market", (t) => ({
  token: t.hex().primaryKey(),
  pool: t.hex().notNull(),
  listedAt: t.bigint().notNull(),
  feeIndex: t.bigint().notNull(),
  totalLenderUsdg: t.bigint().notNull(),
  totalInsuranceUsdg: t.bigint().notNull(),
  borrowCount: t.integer().notNull(),
  liquidationCount: t.integer().notNull(),
  borrowPaused: t.boolean().notNull(),
}));

export const feeAccrual = onchainTable(
  "fee_accrual",
  (t) => ({
    id: t.text().primaryKey(), // txHash:logIndex
    token: t.hex().notNull(),
    feeIndex: t.bigint().notNull(),
    lenderUsdg: t.bigint().notNull(),
    insuranceUsdg: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    block: t.bigint().notNull(),
  }),
  (table) => ({ byToken: index().on(table.token, table.timestamp) }),
);

export const account = onchainTable("account", (t) => ({
  address: t.hex().primaryKey(),
  collateralDeposited: t.bigint().notNull(),
  collateralWithdrawn: t.bigint().notNull(),
  feesPaid: t.bigint().notNull(),
  auctionOpenSince: t.bigint(), // null when no auction is open
  firstSeen: t.bigint().notNull(),
  lastSeen: t.bigint().notNull(),
}));

export const position = onchainTable(
  "position",
  (t) => ({
    id: t.text().primaryKey(), // account:token
    account: t.hex().notNull(),
    token: t.hex().notNull(),
    debtRaw: t.bigint().notNull(),
    borrowedRaw: t.bigint().notNull(),
    repaidRaw: t.bigint().notNull(),
    liquidatedRaw: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({ byAccount: index().on(table.account), byToken: index().on(table.token) }),
);

export const activity = onchainTable(
  "activity",
  (t) => ({
    id: t.text().primaryKey(),
    kind: t.text().notNull(), // deposit | withdraw | borrow | repay | short | cover | liquidation | absorb | lend | unlend | claim | flash
    account: t.hex().notNull(),
    token: t.hex(),
    rawAmount: t.bigint(),
    usdgAmount: t.bigint(),
    counterparty: t.hex(),
    txHash: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
    block: t.bigint().notNull(),
  }),
  (table) => ({ byAccount: index().on(table.account, table.timestamp), byKind: index().on(table.kind, table.timestamp) }),
);

export const lender = onchainTable(
  "lender",
  (t) => ({
    id: t.text().primaryKey(), // account:pool
    account: t.hex().notNull(),
    pool: t.hex().notNull(),
    shares: t.bigint().notNull(),
    depositedRaw: t.bigint().notNull(),
    withdrawnRaw: t.bigint().notNull(),
    claimedUsdg: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({ byAccount: index().on(table.account), byPool: index().on(table.pool) }),
);

export const marketRelations = relations(market, ({ many }) => ({ accruals: many(feeAccrual), positions: many(position) }));
export const feeAccrualRelations = relations(feeAccrual, ({ one }) => ({ market: one(market, { fields: [feeAccrual.token], references: [market.token] }) }));
export const positionRelations = relations(position, ({ one }) => ({
  market: one(market, { fields: [position.token], references: [market.token] }),
  owner: one(account, { fields: [position.account], references: [account.address] }),
}));
export const accountRelations = relations(account, ({ many }) => ({ positions: many(position), activity: many(activity), lending: many(lender) }));
export const activityRelations = relations(activity, ({ one }) => ({ owner: one(account, { fields: [activity.account], references: [account.address] }) }));
export const lenderRelations = relations(lender, ({ one }) => ({ owner: one(account, { fields: [lender.account], references: [account.address] }) }));
