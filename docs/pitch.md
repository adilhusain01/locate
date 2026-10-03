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

## Demo video script (about four minutes)

Written for the judges' four criteria: contract quality, product fit, innovation and real problem solving, with USDG and Robinhood Chain front and centre. Read it at a relaxed pace, about 150 words a minute. Words in brackets are things to read off the screen.

### Before you record

- Record in a desktop browser at 1440 wide or more, zoom at 100 percent, one tab, bookmarks bar hidden, notifications off.
- Use a fresh email for the Privy sign-in so the gas step shows. Do one dry run with a different email first, so you know where the waits are.
- Every transaction waits for a Privy confirmation and a block. Keep recording and cut the waits in the edit.
- Keep the cursor still on whatever you are talking about. Move it only when the narration moves.
- Markets read Closed over the weekend. Scene 8 uses that on purpose.
- Record voice separately if that is easier, then lay it over the screen recording. Add captions; judges often watch muted.
- Upload to YouTube as unlisted and put the link in `docs/submission.md` and the HackQuest form.

### Scene 1. The problem (0:00 to 0:25)

Screen: the landing page, hero loop playing. Do nothing.

> Robinhood put real stocks on-chain. Tesla, Nvidia and Amazon are tokens on Robinhood Chain, and you can buy them at three in the morning on a Sunday. You still can't short them. And if you hold them, they sit in your wallet earning nothing. Locate fixes both. It's a stock lending market for Robinhood Chain.

### Scene 2. One trade, end to end (0:25 to 0:55)

Screen: let the hero loop run from step 1. If it is mid-loop, click step 1 on the rail.

> Here's one trade. Holders deposit NVDA they already own. A trader posts USDG as margin. In one transaction, Locate borrows the shares, sells them on Uniswap, and books the dollars as margin. The trader pays a borrow fee in USDG, and ninety percent of it goes to the people who lent. If the trade goes wrong, a Dutch auction pays the pool back.

### Scene 3. Sign in (0:55 to 1:12)

Screen: click Open the app, then Sign in, enter the email and the code. Open the question mark next to the wallet button, then close it.

> I sign in with just an email, and Privy gives me a wallet on Robinhood Chain testnet. Everything a wallet needs to find the network sits behind this question mark.

### Scene 4. Faucet (1:12 to 1:32)

Screen: Faucet page. Click Get 0.002 testnet ETH for gas, then Claim 1,000 USDG, then Claim 1,000 NVDA.

> A new wallet has no gas, so the faucet sends a little testnet ETH first. Then mock USDG and mock NVDA. The prices are real, though. A keeper copies Nvidia's mainnet Chainlink price onto testnet every five minutes.

### Scene 5. Lend (1:32 to 1:57)

Screen: Lend page with NVDA picked. Type 100, click Approve NVDA, then Deposit. Point at the position card when it updates.

> Lending takes two clicks. I deposit a hundred NVDA, and I still own them, so the price moves, the splits and the dividends stay mine. Splits come free, because Locate counts raw token units, the ones Robinhood's ERC-8056 standard never rescales. A two-for-one split doesn't touch a line of our code.

### Scene 6. Short (1:57 to 2:35)

Screen: Short page. Type 1000 under Deposit, click Approve USDG, then Deposit collateral. Click Approve Locate router. Type 2 under Shares to short, click Short. Point at Collateral, then Health.

> Now the other side. I post a thousand USDG as collateral and approve the Locate router once. Then I short two NVDA. That was a single transaction: borrow, sell on Uniswap, and the proceeds land as margin, the way a brokerage account works. Collateral just went up by the sale. Health is [read the number]. Liquidation starts below one.

### Scene 7. The rate moved (2:35 to 2:55)

Screen: Portfolio for a second, pointing at the liquidation price. Then Markets, pointing at NVDA's utilisation and supply APY.

> Portfolio shows the short with the price where it would be liquidated. And back on Markets, NVDA's utilisation and the lenders' rate just moved, because of my borrow. Every ticker now has a public borrow rate. That's a short interest signal tokenized stocks never had.

### Scene 8. Weekend prices (2:55 to 3:15)

Screen: landing page, Prices section. Scroll slowly past the week strip and the four regimes.

> It's the weekend, so every market reads Closed. Chainlink's stock feeds stop when Wall Street does, but these tokens trade all week. Outside the session, Locate holds the last print, checks it against the Uniswap price inside a band, and values debt at whichever is higher. New borrows also stop half an hour before the open, when weekend gaps hurt most.

### Scene 9. Liquidations and Stylus (3:15 to 3:40)

Screen: scroll to the auction curve, then the Stylus diagram and its numbers.

> Below health one, the auction discount climbs from one to twelve percent over twenty minutes. A liquidator can pay with a flash loan from the pool itself, so it needs no capital at all. The maths behind every decision, the risk engine and the oracle router, is Rust on Arbitrum Stylus. We ran it against a Solidity reference on the live chain, matched it to the wei, and only then switched it on.

### Scene 10. Cover and close (3:40 to 4:05)

Screen: Short page, click Max under Shares to cover, then Cover. Point at Collateral. End on the GitHub repo's `docs/deployments.md`.

> Covering buys the shares back from my collateral, repays the pool and gives me the change. All of this is live on Robinhood Chain testnet, with a mirror on Arbitrum Sepolia: fourteen markets, a hundred Foundry tests including six invariants, seventeen Rust tests, and keepers running around the clock. That's Locate. Holders earn on stock they already own, and traders can finally short it.

### If something goes wrong on camera

- A transaction fails with a gas message: go back to the Faucet and use the gas button, or Robinhood's faucet linked on the same card.
- Short says it needs approval: click Approve Locate router first; it is a one-time step per wallet.
- The health number shows dots: wait two seconds for the chain read, then point at it.
- A market reads Paused: that is the token or sequencer flag. Pick another ticker and say so; it shows the safety rule working.

## Deck (eight slides)

1. The gap: 24/7 trading, 24/5 prices, no short side, idle float.
2. Locate in one picture: lenders, borrowers, USDG, pools, auctions.
3. Why raw units: corporate actions for free.
4. Oracle regimes: open, closed, paused, degraded; the band.
5. Liquidations: Dutch auction plus flash path.
6. Stylus: what runs where and why.
7. What is live and the numbers from testnet.
8. Roadmap and the ask.
