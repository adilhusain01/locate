# Locate

Locate is an on-chain stock lending and borrowing market for tokenized stocks, built first for Robinhood Chain Stock Tokens. Holders lend tokens they already own and earn a fee in USDG. Borrowers post USDG collateral and take tokens to short, hedge, market-make or arbitrage. The protocol is non-custodial and has no token.

Status: live on Robinhood Chain testnet (chain id 46630) since 2 October 2026 with 14 markets, nine mocks and five real faucet Stock Tokens, and mirrored on Arbitrum Sepolia. App: https://locate-pi.vercel.app (landing at `/`, the app at `/app`). Indexer: https://locate-indexer.adilhusain.xyz (GraphQL at `/graphql`, borrow rates at `/markets`). Addresses and verification state in `docs/deployments.md`. Mainnet is read-only (fork tests and the price mirror).

## How it works

- One ERC-4626 pool per ticker. Lenders hold shares over raw token units. All accounting is in raw units, so an ERC-8056 multiplier change (split or dividend) never touches a claim or a debt: the borrower returns the same raw units and the lender's effective shares scale by themselves.
- Borrowers deposit USDG into one account and borrow any listed ticker against it. Fees accrue in USDG against the collateral, so a short stays a fixed number of shares.
- Prices come from Chainlink per raw token. Outside US market hours the feed is stale on purpose, so the oracle router falls back to a pool TWAP clamped to a band around the last print and values debt at the higher of the two.
- Liquidations are Dutch auctions. A flash path swaps the borrower's USDG for tokens on Uniswap inside the call, so liquidators need no capital.
- A Stylus (Rust) risk engine does the health factor, interest rate and auction math; a Solidity reference implementation of the same formulas is used in tests and in differential fuzzing.

The full plan lives in `docs/plan.md`. Decisions that were made along the way are in `docs/decisions.md`.

## Repository layout

```
contracts/      Foundry project: Solidity sources, tests (unit, fuzz, invariant, fork) and deploy scripts
stylus/         Rust workspace: risk-engine, oracle-router and market-calendar Stylus contracts
apps/web/       Next.js app (lend, short, portfolio, auctions, markets)
apps/indexer/   Ponder indexer
apps/keepers/   liquidation bot, price mirror, cap proposer, calendar updater, health monitor
packages/sdk/   viem clients and generated ABIs
scripts/        registry pull, canonical token check, pool depth survey, differential fuzzer
docs/           plan, decisions, spec, risk parameters, threat model, deployments
```

## Getting started

Prerequisites:

- Foundry 1.5 or newer (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Rust stable with the `wasm32-unknown-unknown` target and `cargo-stylus` (`cargo install cargo-stylus`)
- Node 22 or newer and pnpm 10 or newer (`corepack enable`)
- A C toolchain for Rust build scripts (`build-essential` on Debian or Ubuntu, Xcode command line tools on a Mac)

Clone and install:

```bash
git clone --recurse-submodules git@github.com:adilhusain01/locate.git
cd locate
cp .env.example .env   # fill in RPC URLs and a throwaway testnet deployer key
pnpm install
```

Contracts:

```bash
cd contracts
forge build
forge test            # unit and fuzz tests
forge test --match-path "test/fork/*" --fork-url "$ROBINHOOD_RPC_URL"   # fork tests against mainnet
```

Stylus contracts (after the Rust toolchain is in place):

```bash
cd stylus
cargo stylus check --endpoint "$ROBINHOOD_TESTNET_RPC_URL"
```

Web app (`apps/web`, Next.js 16, shadcn, wagmi, Privy optional):

```bash
cp apps/web/.env.example apps/web/.env.local   # NEXT_PUBLIC_PRIVY_APP_ID is optional; without it injected wallets are used
pnpm web:dev
```

Indexer (`apps/indexer`, Ponder 0.17, GraphQL at `/graphql`, borrow-rate feed at `/markets`):

```bash
cd apps/indexer && pnpm dev     # pglite locally; set DATABASE_URL for Postgres
```

Keepers (`apps/keepers`): price mirror, liquidation keeper and health monitor, each with run records. See `apps/keepers/README.md` for the one-shot commands and the systemd units.

Scripts (`scripts/`): `pull-registry.ts` (mainnet Stock Token registry and feeds), `make-testnet-config.ts` (market config), `configure-stylus.ts` and `diff-check.ts` (Stylus setup and the differential check against the Solidity reference).

Deployment addresses per network are kept in `docs/deployments.md`.

## Networks

| Network | Chain id | RPC | Explorer |
|---|---|---|---|
| Robinhood Chain testnet | 46630 | https://rpc.testnet.chain.robinhood.com | https://explorer.testnet.chain.robinhood.com |
| Robinhood Chain mainnet (read-only here) | 4663 | https://rpc.mainnet.chain.robinhood.com | https://robinhoodchain.blockscout.com |
| Arbitrum Sepolia | 421614 | public RPCs | https://sepolia.arbiscan.io |

## Licence

MIT.
