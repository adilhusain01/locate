# Locate

**Stock lending for Robinhood Chain.** Earn USDG on the stock tokens you hold, or borrow them to go short, any hour of the week.

Live app: https://locate-pi.vercel.app
Code: https://github.com/adilhusain01/locate

## The problem

Robinhood Chain put real US stocks on-chain as tokens. They trade around the clock, yet there is no way to short them on-chain, and the shares people hold sit idle and earn nothing. Traditional markets run on a stock lending desk, and Robinhood Chain had none.

## What Locate does

- **Lend.** Deposit a stock token such as NVDA into its pool and earn the borrow fee in USDG. You keep the shares, so price moves, splits and dividends stay yours.
- **Short.** Post USDG once as margin and borrow any listed ticker against it. One transaction borrows the shares, sells them on Uniswap and books the proceeds as margin, the way a brokerage account works. Covering buys them back and repays in one transaction too.
- **Liquidate.** Below health 1, a Dutch auction opens and its discount grows from 1 to 12 percent over 20 minutes. Liquidators can pay with a flash loan from the pool itself, so they need no capital.

Every market publishes its borrow rate, a public short interest signal that tokenized stocks did not have before.

## How it holds up on this chain

- **Corporate actions cost nothing.** Robinhood's Stock Tokens follow ERC-8056: a split or dividend changes a multiplier and leaves raw balances alone. Locate counts raw units everywhere, so a 2-for-1 split needs no code and no migration. Borrowers return the same raw units, and lenders' effective shares scale by themselves.
- **Prices work on weekends.** Chainlink's equity feeds run 24/5 while the tokens trade 24/7. Locate's oracle router knows Robinhood's session, US holidays and daylight saving. Outside the session it checks the last print against the Uniswap TWAP inside a band and values debt at whichever is higher. New borrows stop 30 minutes before the open, and a paused token or a sequencer outage blocks new borrows while repaying, covering and liquidating stay open.
- **Fees are simple.** Borrowers pay in USDG. 90 percent goes to lenders and 10 percent to an insurance fund that absorbs bad debt first.

## Built with Stylus

The risk engine, the oracle router and the market calendar are Rust contracts on Arbitrum Stylus. Each has a Solidity reference. Before switching the protocol to Stylus, we compared the two on the live chain across health checks, rate points, auction points and every market's price quote, and they matched to the wei.

## What is live

- 14 markets on Robinhood Chain testnet: nine mocks priced from mainnet Chainlink prints, plus the five real faucet Stock Tokens (AMD, AMZN, NFLX, PLTR, TSLA).
- A mirror deployment on Arbitrum Sepolia with nine markets.
- Seeded Uniswap v3 pools, and keepers for price mirroring, liquidations and health monitoring, running on a VPS.
- A Ponder indexer with a public borrow-rate feed at https://locate-indexer.adilhusain.xyz/markets.
- The web app with email sign-in through Privy, a gas drip for new wallets and a faucet, so anyone can try a full lend and short in a few minutes.
- Every Locate contract is source-verified on the explorers.

## Testing

100 Foundry tests written from the requirements before the code, covering unit, fuzz and integration tests against real Uniswap v3 bytecode, plus a full deployment test. Six of them are invariants over the pool and controller accounting. There are also 17 Rust tests and the on-chain differential check, and CI runs all of it on every push.

## USDG at the centre

USDG is the collateral, the fee currency and the liquidation currency. On testnet a mock USDG with a faucet stands in, and the mainnet USDG with its USDG/USD Chainlink feed is already wired into the registry.

## Next

An outside review of the Stylus and liquidation code, then stock tokens and pool shares as collateral, Dinari dShares markets on Arbitrum One, term loans with lender recall, and a hard-to-borrow auction.
