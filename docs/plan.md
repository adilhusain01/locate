# Locate

Working name (Claude's suggestion, 2026-10-02; alternatives: Shortlist, Rehypo). Locate is an on-chain stock lending and borrowing market for tokenized stocks, starting with Robinhood Chain Stock Tokens. Holders lend tokens they already own and earn a borrow fee. Borrowers post USDG and take tokens to short, hedge, market-make or arbitrage. It is the product behind the recommendation in Arbitrum Open House Singapore Online Buildathon; Adil asked for the complete plan, nothing cut, on 2026-10-02. Status: planned, not started.

## Why it should exist

- About $52.4M of tokenized-equity float sits in wallets with liquid USDG pools and earns nothing (sqd.dev measurement, August 2026). Robinhood's off-chain Stock Lending pays the customer up to 15% of gross revenue and excludes fractional shares.
- $270.6M of stock tokens traded on Sunday 30 August 2026, and there is no way to go short on-chain. Market makers can only quote inventory they own, and arbitrageurs can close a premium only in one direction.
- An equity borrow rate is a core price signal in traditional markets. The first on-chain one will be quoted by everyone who writes about this chain.
- It fits all four judging criteria without stretching: contract quality (ERC-4626 pools, a Stylus risk engine, differential fuzzing), product-market fit (lenders and would-be shorts exist today), innovation (a new primitive plus liquidations tuned for a 24/7 asset priced by a 24/5 oracle), real problem (idle float, no short side). USDG is the collateral asset, not a bolt-on, and the main deployment is Robinhood Chain.

## Facts the design rests on (checked 2026-10-02)

- Stock Tokens are ERC-20 with 18 decimals and ERC-8056. `balanceOf` is raw and never changes on a corporate action; `uiMultiplier()` (1e18 = 1.0) scales it to shares. Also `balanceOfUI`, `newUIMultiplier()`, `effectiveAt()`, and the events `TransferWithScaledUI` and `UIMultiplierUpdated`. Dividends are reinvested by raising the multiplier.
- Canonical tokens are beacon proxies over one shared Stock implementation and are listed in the live registry at docs.robinhood.com/chain/contracts. Counterfeits with the right ticker exist (a fake GME was documented), so listing verifies the implementation and never the name.
- Chainlink feeds on Robinhood Chain return the price of one raw token (share price times multiplier) with 8 decimals, update 24/5 during US market hours, expose `oraclePaused()` around corporate actions, and the chain has a sequencer uptime feed. The authoritative list is docs.chain.link with network=robinhood. A community SDK counted 34 live feeds against 95 verified tokens, so some tokens have no feed.
- USDG mainnet `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 decimals). WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`. Permit2 at its canonical address. ERC-4337 EntryPoints v0.6, v0.7 and v0.8 are deployed; Alchemy, ZeroDev, Privy and EIP-7702 are supported.
- Pools: a Uniswap v4 singleton at `0x8366a39cc670b4001a1121b8f6a443a643e40951`, Algebra (v3-style) pools and v2 pairs. 46 tokens have liquid USDG pools; NVDA, SPY, SPCX and GME carry most volume. The float is small against volume, so pool depth, not token supply, sets safe borrow caps.
- Chain id 4663, RPC `https://rpc.mainnet.chain.robinhood.com`, 100 ms blocks, ETH for gas, ArbOS far above 30 so Stylus is available. Testnet 46630 has a faucet that hands out test Stock Tokens.
- Stock Tokens may not be offered to US persons; the issuer also names Canada, the UK and Switzerland as restricted.

## Product

Three flows and one public page.

Lend: pick a ticker, deposit tokens, receive an ERC-4626 share token (lNVDA for NVDA). The position shows raw tokens, effective shares (raw times multiplier), yield accrued and the current supply rate. Withdraw any time there is idle liquidity; when utilisation is high the rate rises until borrowers repay. A helper lets a lender take accrued yield as USDG in one transaction.

Short or borrow: deposit USDG as collateral, borrow tokens from any listed market against it (one account, many tickers), and either take delivery or press Short, which borrows and sells on Uniswap in one transaction with the proceeds credited back as collateral. Cover buys back, repays and releases collateral in one transaction. The screen shows health factor, liquidation price per ticker and the live borrow rate.

Liquidate: open auctions are listed with the current discount. Anyone can liquidate by supplying tokens or by using the flash path (collateral is swapped for tokens on Uniswap inside the call, so no capital is needed).

Markets: every ticker with supply rate, borrow rate, utilisation, idle liquidity, oracle regime and pool depth. This page doubles as the public borrow-rate feed, with a JSON endpoint and an embeddable widget.

## Mechanism

Accounting is in raw units everywhere. The borrower owes raw units, so splits and dividends flow to the lender with no special code: the same raw units bought back later carry the new multiplier. Chainlink prices are per raw token and already include the multiplier, so the risk math never touches `uiMultiplier` either; the frontend uses it only for display.

Debt accrues in token units through a per-market borrow index (Aave style). Lenders earn in tokens, which is the natural unit for a stock loan ("more shares"), and accrual never depends on an oracle. Of the fee, 90% goes to lenders and 10% to the insurance fund.

Collateral is USDG only in v1, valued at 1.00 with a depeg circuit breaker (a USDG/USD feed if Chainlink publishes one on this chain, else a guardian pause). Stock tokens and lTokens become collateral in v2.

One account can borrow many tickers against one USDG balance (cross-margin across shorts). Health factor = collateral value times liquidation threshold divided by total debt value, where debt value sums raw units times the conservative price per market.

Oracle regimes, per market: open (fresh Chainlink, used directly); closed (Chainlink stale on schedule: price = pool TWAP clamped to a band around the last Chainlink print, with the band widening by hours since close); paused (`oraclePaused()` true or the sequencer feed reports downtime: borrows stop, repay and withdraw continue, liquidations use the last good price with an extra haircut); degraded (sources disagree beyond the band: same as paused). Debt is always valued at the higher of the anchored pool price and the last Chainlink print, so weekend news that moves the pool raises collateral requirements immediately.

Liquidation is a Dutch auction per position: once health drops below 1, the discount on the collateral starts at 1% and rises linearly to 12% over 20 minutes, then holds. Close factor 50%, or 100% when health is below 0.95. A flash path swaps the borrower's USDG for tokens on Uniswap inside the call. Bad debt waterfall: insurance fund first, then a pro-rata haircut on that market's lenders, documented plainly.

Caps: per-market borrow cap = the lower of 60% of pool supply and 10% of the USDG pool depth inside 2% price impact (measured weekly by a keeper, applied by the admin). Per-account collateral cap on mainnet until review (10k USDG). Utilisation hard cap 90% so lenders always have an exit buffer.

Pre-open guard: 30 minutes before NYSE open, if the pool price sits outside the band of the last Chainlink print, borrows in that market pause until the first fresh update lands.

Flash loans of stock tokens (ERC-3156) at 0.05%, paid to the pool, for arbitrageurs and liquidators.

## Contracts

| Contract | Language | Job | Notes |
|---|---|---|---|
| MarketFactory | Solidity | Lists markets, verifies the token is a canonical Stock Token (shared implementation check), verifies the feed answers, stores tiers | The factory address goes in the HackQuest form |
| LendingPool (one per ticker) | Solidity, OpenZeppelin ERC-4626 | Lender shares, borrow index, utilisation, reserve factor, ERC-3156 flash loans, ERC-8056 pass-through views so lTokens show effective shares | Virtual shares offset against the inflation attack; `borrow` and `repay` only callable by Controller |
| Controller | Solidity | Accounts, USDG collateral, multi-market borrow and repay, auction state, pause flags | Gathers positions and calls the Stylus engine |
| RiskEngine | Rust, Stylus | Pure math: health factor over N positions, max borrow, Dutch discount, kinked interest rate, WAD fixed point | Pure function over calldata, so no storage reads in Stylus |
| OracleRouter | Rust, Stylus | Chainlink read with staleness, pause and sequencer checks; TWAP from v3 or Algebra `observe()`; recorded observations for v4 pools; regime and band logic | The weakest link is the keeper-pushed v4 observation; it is bounded on-chain and only used in the closed regime |
| MarketCalendar | Rust, Stylus | NYSE open or closed for a timestamp, DST, holiday list the admin updates yearly | Drives the regime and the pre-open guard |
| ObservationRecorder | Solidity | Keeper pushes v4 spot samples; rejects samples outside the Chainlink band or with non-monotone timestamps; median of the last 13 | Used only where no v3 or Algebra pool exists |
| ShortRouter | Solidity | Short (borrow, sell, credit proceeds), Cover (buy, repay, release), claim yield as USDG | Takes an encoded Uniswap route and a min-out from the frontend; never hard-codes a venue |
| Liquidator | Solidity | Direct and flash liquidations through v3, Algebra or v4 routes | Permissionless |
| InsuranceFund | Solidity | Receives the 10% reserve, pays bad debt first | Owner-controlled withdrawals through the timelock only |
| RiskMathRef | Solidity | Reference implementation of the RiskEngine formulas | Used by Foundry tests and by the differential fuzzer against the Stylus build |
| Mocks | Solidity | MockStockToken (full ERC-8056 with pending multiplier), MockFeed with `oraclePaused`, MockSequencerFeed | Testnet and tests only |

Admin model: a 2-of-3 Safe behind a 24 hour timelock for parameters and listings; a Guardian key that can pause borrows and listings at once but can never pause repay, lender withdrawals of idle liquidity or liquidations.

## Risk parameters, v1

| Tier | Who qualifies | Initial collateral | Liquidation threshold | Dutch discount | Borrow cap | Rate at 0% / kink 80% / 100% |
|---|---|---|---|---|---|---|
| A | Chainlink feed and USDG pool depth over $1M | 150% | 125% | 1% to 12% over 20 min | per the cap rule | 1% / 10% / 150% APR |
| B | Chainlink feed and depth $250k to $1M | 200% | 150% | 2% to 15% over 20 min | half of the cap rule | 2% / 15% / 200% APR |
| Not listed | No feed, or depth under $250k | | | | | |

Starting set, to be confirmed by the depth script in week 1: NVDA, SPY, AAPL, MSFT, TSLA, GME, AMZN, GOOGL, META, SPCX if a feed exists.

## Stack (from Stack Defaults and Design Taste)

- Contracts: Solidity 0.8.x with OpenZeppelin 5, Foundry (recommended over the Hardhat default for fuzz, invariant and fork tests; Hardhat 3 is the alternative). Stylus crates with `stylus-sdk` and `cargo stylus`; Rust math with `alloy-primitives` U256 and WAD helpers; `proptest` for property tests.
- Local chain: the Offchain Labs Nitro dev node in Docker with Stylus enabled, for the differential fuzzer and integration runs. Foundry cannot execute Stylus bytecode, so Solidity unit tests use RiskMathRef and the real engine is exercised on the dev node and the testnet.
- Web: Next.js App Router, shadcn/ui, Tailwind inline in JSX, TanStack Query, Zustand, React Hook Form with Zod, Sonner, better-icons, wagmi and viem, Privy for wallets (embedded plus external, chain 4663, gas sponsorship through its AA tooling), one design-tokens file, PostHog behind consent. Hosted on Vercel.
- Data: Ponder as the indexer (markets, accounts, positions, hourly rate snapshots, auctions, regime log) writing to Postgres on Neon; the app reads it through TanStack Query; live position data straight from the chain with viem.
- Keepers (TypeScript, on the VPS under systemd): liquidation bot (health scan by multicall, simulate, flash liquidate above a profit floor), observation recorder, cap proposer (reads pool depth weekly), calendar updater, health monitor (sequencer, feed staleness, keeper heartbeats). Every job writes a run record and keeps failures with their input, per Code Style. Alerts by Resend email.
- CI: GitHub Actions running forge fmt and test (with fuzz runs), cargo clippy and test, Slither and Aderyn, typecheck, lint, build, and a Playwright smoke run. Vercel previews per PR; production only from `main`. Secrets live in GitHub, Vercel and the VPS environment only.

## Repo layout

Private GitHub repo from day one, with `.gitignore`, a README whose Getting started really works, and `.env.example` listing names only.

```
locate/
  contracts/        Foundry: src, test (unit, fuzz, invariant, fork), script (deploy, list, params)
  stylus/           cargo workspace: risk-engine, oracle-router, market-calendar
  apps/web/         Next.js app
  apps/indexer/     Ponder
  apps/keepers/     liquidation bot, recorder, cap proposer, calendar updater, health monitor
  packages/sdk/     viem clients, ABIs generated by the wagmi CLI, route quoting
  scripts/          registry pull, canonical-token check, pool depth survey, difftest harness
  docs/             spec, risk-params, oracle, threat-model, audit-checklist, deployments
```

Branches: `main` (protected, deploys), `dev`, feature branches. Commit messages without em dashes.

## Tests, written from these requirements before the code

Unit and fuzz (Foundry):
- A deposit of R raw units mints shares worth R raw units; after a multiplier change the share's raw claim is unchanged and its effective shares scale by the multiplier.
- Borrowing above the max allowed by the tier reverts; borrowing exactly at it succeeds.
- Debt grows with the borrow index; a repay of the full indexed debt leaves zero.
- Health factor equals the formula for random positions, collateral and prices (fuzzed), and agrees with RiskMathRef.
- A paused feed, a stale feed, a sequencer outage and a source disagreement each put the market in the right regime and block borrows while allowing repay and withdraw.
- Dutch discount is 1% at auction start, 12% at 20 minutes, 12% after; close factor 50% above 0.95 health and 100% below.
- Flash loan of X tokens must return X plus 0.05% in the same transaction or revert.
- Lender withdrawals above idle liquidity revert with a clear reason; utilisation can never exceed 90% through borrows.
- The inflation attack on an empty pool fails to steal from the next depositor.

Invariants (Foundry invariant tests over random action sequences):
- Pool assets equal idle balance plus outstanding debt.
- No action other than a price move can take an account's health from at least 1 to below 1.
- A liquidation never lowers the protocol's total collateral coverage.
- The sum of lender shares' raw claims never exceeds pool assets.
- Raw accounting is unchanged across any multiplier change.

Fork tests (Robinhood Chain mainnet fork): list NVDA with its real feed and pool; lend, short through the real Uniswap route, warp to a Saturday and check the closed regime; mock `oraclePaused` and check the paused regime; mock a multiplier change through `vm.mockCall` and check lender effective shares rise with raw claims unchanged.

Differential fuzzing (dev node, TypeScript with fast-check): the Stylus RiskEngine and OracleRouter must match RiskMathRef and a TypeScript reference on random inputs to within 1 wei.

Frontend (Playwright): lend, short, cover and liquidate on the testnet; zero horizontal overflow at 360 and 390 wide; reduced motion honoured; the US and other restricted regions see the gate.

## Security and operations

Threat model to write in `docs/threat-model.md` and check off: oracle manipulation on thin weekend pools (bands, max-of-sources, caps tied to depth, pre-open guard); reentrancy through flash loans and Uniswap callbacks (checks-effects-interactions, OpenZeppelin ReentrancyGuard, no untrusted calls before state updates); ERC-4626 inflation (virtual offset); rounding direction (round against the user on every conversion); decimals (6, 8, 18 normalised to 1e18 in one place); issuer actions (a token pause or blocklist on the canonical contract puts the market in paused regime automatically); admin key compromise (timelock, multisig, guardian limited to pausing); sequencer downtime (grace period after recovery before liquidations resume); bad debt (insurance fund, then socialised haircut, both documented on the Markets page).

Static analysis on every PR; a self-audit pass against the checklist before mainnet; a walkthrough in the Arbitrum feedback sessions; an external review funded from the first milestone payout.

Monitoring: the health monitor tracks sequencer status, each feed's staleness, each keeper's heartbeat, pending auctions older than 30 minutes and insurance fund balance, and emails on breach. Every keeper job has a run record and a retry path.

## Compliance posture

The protocol is non-custodial software; it never holds user funds outside the contracts and takes no spread, only the reserve share of fees. The web app geo-gates the United States and the other jurisdictions the issuer names, shows the issuer's eligibility notice, and asks for an acknowledgment before the first transaction. No token, no points. Put a short legal note in the docs and have it read by someone qualified before caps are raised.

## Build plan, 21 days

Days 1 to 2: repo, CI, Foundry and Stylus scaffolds, Nitro dev node running. Scripts: pull the registry, verify canonical tokens by implementation, survey USDG pool depth per ticker. MockStockToken with pending multiplier, MockFeed with pause. LendingPool with its tests written first.

Days 3 to 5: Controller, RiskMathRef, OracleRouter v0 in Solidity (Chainlink, staleness, regimes), interest rate model, Dutch liquidation, Liquidator with a v3 route. Fork tests against mainnet. Deploy to testnet 46630 with faucet tokens. Checkpoint 1: lend, short, liquidate on testnet through scripts.

Days 6 to 8: Stylus crates (RiskEngine, OracleRouter, MarketCalendar), the differential fuzzer on the dev node, deploy to testnet, point Controller at the Stylus engine. Checkpoint 2: Stylus engine live with a gas comparison against RiskMathRef.

Days 9 to 11: web app scaffold with tokens, Markets, Lend, Short and Cover (ShortRouter), Portfolio, auctions list, geo gate, Privy. Ponder indexer with rate snapshots. Liquidation bot and health monitor with run records. Checkpoint 3: full product on testnet.

Days 12 to 14: mainnet deployment behind the timelock with tiny caps; v4 route support and ObservationRecorder for tickers without v3 pools; cap proposer from the depth survey; `docs/deployments.md`. Checkpoint 4: mainnet live, verified on Blockscout, two or three tier-A markets.

Days 15 to 17: hardening: invariant runs, Slither and Aderyn clean, self-audit, gas report, failure drills (feed paused, sequencer down, depeg, keeper dead), Arbitrum Sepolia mirror with mocks, feedback session with the Arbitrum team.

Days 18 to 21: UI polish at 360 and 390 wide, reduced motion, copy; README, spec and risk docs; demo video; deck; HackQuest form (frontend link, contract addresses per network, factory address); public borrow-rate endpoint and widget; launch post.

The order is chosen so that whatever exists at any checkpoint is demoable. Against the 4 October deadline of the Singapore edition, checkpoint 1 with a thin UI is what fits; that is a fact about the calendar, not a change to this plan.

## Demo video (3 minutes)

The idle float and the Sunday volume. Lend NVDA and watch lNVDA and effective shares. Short NVDA on a Sunday with USDG, borrow rate moves with utilisation. A price move opens a Dutch auction and the flash path clears it. A multiplier update on the testnet mock: the lender's effective shares rise, health factors do not move, no code ran. The Stylus engine's gas next to the Solidity reference. The mainnet contracts on Blockscout with their caps. The roadmap.

## After the buildathon: milestones for the prize payouts

- M1, four weeks: external review done and findings fixed; caps raised; ten markets; two independent liquidation keepers; USDG/USD feed wired if available.
- M2, eight weeks: v2 collateral (stock tokens and lTokens), portfolio margin in the Stylus engine (long one name, short another), Dinari dShares markets on Arbitrum One once their split mechanics and feeds are verified.
- M3, twelve weeks: term loans (fixed term, fixed fee, the TradFi stock loan), lender recall with a premium, a hard-to-borrow auction where lenders post minimum fees, an institutional API, delegated borrow capacity for agents through EIP-7702 session keys with spend limits, and an x402-gated history API.

## Decisions for Adil

1. Name: Locate (recommended), Shortlist or Rehypo.
2. Solidity toolchain: Foundry (recommended for fuzz, invariant and fork tests, and `cast` for Stylus calls) or Hardhat 3.
3. Wallet layer: Privy (recommended: embedded wallets plus gas sponsorship on this chain) or RainbowKit.
4. Mainnet during the build with tiny caps (recommended; judges can verify real tokens) or testnet only.
5. Fee unit: tokens (recommended; no oracle in accrual) or USDG.
6. Solo (recommended; the Rust surface is three small crates and ArbiPic already shipped Stylus) or a Rust partner.
7. Enter the Singapore edition with checkpoint 1 by 4 October 21:29 IST, or build the full 21 days for the next Open House and the grant track.

## Open risks

- Weekend pricing on thin pools remains the main risk; caps tied to depth and the max-of-sources rule contain it but do not remove it.
- Whether a USDG/USD Chainlink feed exists on Robinhood Chain is unchecked.
- The sqd.dev address for the shared Stock implementation did not parse as a valid address in the fetch; verify it against the registry before writing the canonical check.
- Securities lending of tokenized securities may draw regulatory comment even for non-custodial software; the posture above is a start, not an opinion from counsel.
- The 99 unsubmitted drafts in the Singapore edition were not visible; one could overlap.

Related: Arbitrum Open House Singapore Online Buildathon, Arbitrum, PayPerCard, ClawPay, ArbiPic, Hackathon Winners 2025-2026, Projects - Web3 and hackathons.
