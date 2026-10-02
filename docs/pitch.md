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

## Shot list for recording (desktop browser, about four minutes)

Record at 1440 wide or wider, cursor visible, no narration needed if you add captions later. Use the Privy email login with a fresh address so the gas step shows.

| # | Where | Do | Say or caption |
|---|---|---|---|
| 1 | https://locate-pi.vercel.app | Scroll the hero and the live ticket slowly; pause on the live markets table | "Fourteen stock token markets on Robinhood Chain testnet, five of them the real faucet tokens. Every ticker already has a borrow rate." |
| 2 | Landing, How a market works | Scroll past the roles diagram and the sequence diagram | "Lenders hold shares over raw units. A short borrows, sells and books the proceeds as margin before the ratio check." |
| 3 | Open app, Sign in | Email login, code, wallet created | "Judges get a wallet from an email." |
| 4 | /app/faucet | Get 0.002 testnet ETH for gas, then Claim 1,000 USDG, then Claim 1,000 NVDA | "Testnet gas and mock assets; prices are the mainnet Chainlink prints, mirrored." |
| 5 | /app/lend?ticker=NVDA | Approve, deposit 100 NVDA; point at effective shares and the multiplier | "You keep the stock, the splits and the dividends; the fee is paid in USDG." |
| 6 | /app/short?ticker=NVDA | Approve USDG, deposit 1,000 USDG, Approve Locate router, short 2 NVDA; point at collateral rising by the proceeds and the health factor | "One transaction. The sale proceeds count as margin, like a brokerage." |
| 7 | /app/portfolio | Show the short row with its liquidation price and the lending row with claimable USDG | "Liquidation price is where health reaches one." |
| 8 | Landing, Prices and Liquidations | Scroll the week strip, the regime machine and the auction curve | "Chainlink runs 24/5, the tokens trade 24/7. Outside the session the pool price moves the last print inside a band. Below health one, a Dutch auction; the flash path needs no capital." |
| 9 | Landing, Stylus | Scroll the architecture diagram and the numbers | "Risk engine and oracle router are Rust on Stylus, checked against the Solidity reference on the live chain to the wei before the switch." |
| 10 | /app/short | Cover the 2 NVDA; point at collateral after | "Cover buys back, repays and returns the change." |
| 11 | GitHub repo, docs/deployments.md | Show the addresses and the test counts | "100 Foundry tests, six invariants, 17 Rust tests, everything deployed and verified." |

Keep each shot under 25 seconds. If a transaction waits on the chain, cut the wait.
