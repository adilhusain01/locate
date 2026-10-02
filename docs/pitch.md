# Locate: pitch and demo

## One line

Locate is the first on-chain stock lending and borrowing market for Robinhood Chain stock tokens: holders earn USDG on shares they already own, and anyone can short a stock token against USDG, 24/7.

## Why now

- Robinhood Chain stock tokens trade around the clock, but there is no way to go short on-chain and no yield on the float. The same tokens that traded 270 million dollars on a Sunday earn their holders nothing.
- Robinhood's own Stock Lending pays customers up to 15 percent of gross revenue and excludes fractional shares. On-chain, the lender keeps 90 percent, fractions lend, and the collateral is visible.
- The borrow rate per ticker is a price signal that does not exist on-chain yet. Locate publishes it.

## What is live (Robinhood Chain testnet)

- 14 markets: nine mocks priced from the mainnet Chainlink feeds and five real faucet Stock Tokens (AMD, AMZN, NFLX, PLTR, TSLA).
- Controller running on a Stylus risk engine and a Stylus oracle router, both checked against the Solidity reference on the live chain.
- One-transaction short and cover through Uniswap v3; capital-free flash liquidations through the pools' own flash loans.
- Keepers mirroring mainnet prices, liquidating, and poking accruals; an indexer with a public borrow-rate feed; a web app with embedded wallets.

## Judging criteria, mapped

| Criterion | Where it shows |
|---|---|
| Smart contract quality | 94 Foundry tests from requirements first, invariant suite, real Uniswap bytecode in tests, Stylus engine with a differential check to the wei, ERC-4626 with inflation guards, raw-unit accounting that makes corporate actions a no-op |
| Product-market fit | Lenders and would-be shorts exist today; the product mirrors a Robinhood feature customers already know |
| Innovation | A new primitive for tokenized equities; the first on-chain equity borrow rate; auctions and oracle regimes tuned for a 24/7 asset priced by a 24/5 feed |
| Real problem | Idle float, no short side, no hedging for the chain's market makers |
| USDG | Collateral, fee and liquidation currency, not a bolt-on |
| Robinhood Chain | Built for its Stock Tokens, their multiplier and their feed schedule; deployed on its testnet with its faucet tokens |

## Demo script (three minutes)

1. Markets page: the borrow rate column. "Nobody could short these tokens until now; this is the first borrow rate for equities on-chain."
2. Lend 100 NVDA: lNVDA appears, effective shares shown with the multiplier. "You keep the stock, the splits and the dividends; you earn USDG."
3. Short 10 NVDA with 1,500 USDG: one transaction, proceeds land as margin, health shows 1.28. "A Sunday short, on-chain, with the proceeds counting as margin like a real brokerage."
4. Move the price 30 percent on the mock feed: health drops below 1, an auction opens; the keeper flash-liquidates with no capital; lenders earned the flash fee.
5. Corporate action on the mock: multiplier update, lender's effective shares rise, debt and health do not move, no code ran.
6. Stylus: the risk engine's gas next to the Solidity reference; the differential check output.
7. Close on the roadmap: external review, v2 collateral, Dinari markets on Arbitrum One, term loans and lender recall.

## Deck (eight slides)

1. The gap: 24/7 trading, 24/5 prices, no short side, idle float.
2. Locate in one picture: lenders, borrowers, USDG, pools, auctions.
3. Why raw units: corporate actions for free.
4. Oracle regimes: open, closed, paused, degraded; the band.
5. Liquidations: Dutch auction plus flash path.
6. Stylus: what runs where and why.
7. What is live and the numbers from testnet.
8. Roadmap and the ask.
