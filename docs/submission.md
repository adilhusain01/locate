# HackQuest submission: Arbitrum Open House Singapore Online Buildathon

Everything the form asks for, ready to paste. Deadline 4 October 2026, 21:29 IST (15:59 UTC). Tracks to tick: Overall Prize, Promising Products Track, Grants. Ecosystem: Arbitrum (Robinhood Chain). Sector tags: DeFi, RWA, Infra.

## Project name

Locate

## One line intro (under 160 characters)

The first on-chain stock lending and borrowing market for Robinhood Chain stock tokens: earn USDG on shares you hold, or short them against USDG, 24/7.

## Project detail

A tighter, form-ready version of this section lives in `docs/description.md`.

**The gap.** Robinhood Chain stock tokens trade around the clock, but there is no way to go short on-chain and the float earns nothing. Sunday 30 August 2026 alone saw 270 million dollars of stock token volume with no borrow side at all. Robinhood's own off-chain Stock Lending pays customers up to 15 percent of gross revenue and excludes fractional shares.

**What Locate does.** Lenders deposit a stock token into an ERC-4626 pool and earn the borrow fee in USDG while keeping the price, the splits and the dividends. Borrowers post USDG into one account and borrow any listed ticker against it; a one-transaction short borrows, sells on Uniswap v3 and counts the proceeds as margin, the way a brokerage does. Covering buys back and repays in one transaction. Liquidations are Dutch auctions with a capital-free flash path funded by the pool's own flash loans. Every market publishes its borrow rate: the first on-chain borrow rate for equities.

**Why the design holds up on this chain.**
- All accounting is in raw units. Stock Tokens are ERC-8056, so splits and dividends land as multiplier changes; the borrower returns the same raw units and the lender's effective shares scale by themselves. Corporate actions cost no code.
- Prices come from the Chainlink per-token feeds, which run 24/5. The oracle router knows Robinhood's session (Sunday 20:00 ET to Friday 20:00 ET, US holidays, daylight saving): inside it, fresh prints; outside it, the pool TWAP clamped to a band around the last print that widens by the hour; debt is always valued at the higher of the two. A paused token flag, a sequencer outage or a stale print blocks new borrows while repay, withdraw and liquidate stay open.
- Fees accrue in USDG per market as an index; lenders are credited at accrual, borrowers pay out of collateral when touched, 90 percent to lenders and 10 percent to an insurance fund that absorbs bad debt first.

**Stylus.** The risk engine (health across N positions, kinked rate, Dutch discount), the market calendar and the oracle router (TickMath port, TWAP band, regimes) are Rust contracts on Stylus. A Solidity reference of each exists; `scripts/diff-check.ts` compared them on the live chain over 40 random health evaluations, nine rate points, six auction points and all 14 quotes, found them identical to the wei, and only then switched the Controller over.

**Live on Robinhood Chain testnet.** 14 markets: nine mocks priced from the mainnet feeds and five real faucet Stock Tokens (AMD, AMZN, NFLX, PLTR, TSLA, verified as beacon proxies of the shared Stock implementation). Seeded Uniswap v3 pools, a price mirror that copies the mainnet prints, a liquidation keeper, a health monitor, a Ponder indexer with a public borrow-rate feed, and the web app at https://locate-pi.vercel.app with embedded wallets. Mirrored on Arbitrum Sepolia.

**Testing.** 100 Foundry tests written from the requirements first (unit, fuzz, integration against the real Uniswap v3 bytecode, a full deployment test), a handler-based invariant suite (pool and controller accounting, debt equals the sum of positions, USDG solvency, share backing), 17 Rust unit tests, and the on-chain differential check. CI runs all of it on every push.

**USDG.** Collateral, fee and liquidation currency. On testnet a mock USDG with a faucet stands in; the mainnet USDG and its USDG/USD feed are wired into the registry and the mirror.

**Roadmap (milestones).** Outside review of the Stylus and liquidation code; stock tokens and pool shares as collateral with portfolio margin; Dinari dShares markets on Arbitrum One; term loans and lender recall; a hard-to-borrow auction; agent delegation through EIP-7702 session keys.

## Tech tags

Solidity, Rust, Stylus, Foundry, OpenZeppelin, ERC-4626, ERC-8056, ERC-3156, Chainlink, Uniswap v3, Next.js, wagmi, viem, Privy, Ponder, TypeScript

## Links

- Live app: https://locate-pi.vercel.app
- Repository: https://github.com/adilhusain01/locate (public)
- Demo video: TO ADD (YouTube link)
- Pitch video: same as the demo, or TO ADD
- Deployments: https://github.com/adilhusain01/locate/blob/main/docs/deployments.md

## Core protocol / smart contract addresses (one per line, network: address - label)

Robinhood Chain: 0x58039eAeBB9d7bB56d1f3d1da9e5362D34AE8cF6 - Controller (accounts, borrowing, fees, auctions)
Robinhood Chain: 0x4b7c8bd51abda2ccf421312094e368895c8953f0 - Risk engine (Stylus, live)
Robinhood Chain: 0x2fc6e9895772017d769b3e6f7680f90ff7a154e7 - Oracle router (Stylus, live)
Robinhood Chain: 0x0735725103ac33a4ed1c4919539c01139703c6ad - Market calendar (Stylus)
Robinhood Chain: 0x02506EDF3cF27b806165CA929ba5a97eE885d445 - ShortRouter (one-transaction short and cover)
Robinhood Chain: 0x6ef81De294cd0C11d99F01D0808b3AF7302eDebC - Liquidator (flash liquidations)
Robinhood Chain: 0x3395E28437839E6E81eE77FECF827FFb29503386 - Oracle router (Solidity reference)
Robinhood Chain: 0x86B86d390C225F1643c2C0C422AEe3b989171589 - RiskMathRef (Solidity reference)
Robinhood Chain: 0x62B2697e27DEcD2Ae494172c991814f38f493Bcd - Mock USDG (collateral, faucet)
Arbitrum Sepolia: 0x6c79924FC12d4645EFCB337Ab07D76783F7555c2 - Controller (mirror)
Arbitrum Sepolia: 0x6081650D5e5791f3747bf934F287b83d694224b0 - ShortRouter (mirror)
Arbitrum Sepolia: 0x328dDA4319d78e3d7E52B9cab20D474eE3D74c75 - Liquidator (mirror)

## Factory / pool contracts

Robinhood Chain: 0x2d2315964e124B177C298B4d7334471f58f8754a - Locate NVDA lending pool (ERC-4626)
Robinhood Chain: 0xD016167c8a5cEa10Aae3826233C58d0706286EDb - Locate SPY lending pool (ERC-4626)
Robinhood Chain: 0xc619EEB4E03488f1bDB4145086Db57FF3Ae9a20d - Locate AAPL lending pool (ERC-4626)
Robinhood Chain: 0xD76742de8cbB9573cdE044a44Bcc27ACE808aAd1 - Locate MSFT lending pool (ERC-4626)
Robinhood Chain: 0xEc37876062d07085FdF2E1a567CcfBe4526AcE2d - Locate GOOGL lending pool (ERC-4626)
Robinhood Chain: 0x8Aa81Ab54c1c8de0fFB684E0E0c3aC2e3B0b15e4 - Locate META lending pool (ERC-4626)
Robinhood Chain: 0x3821493B6Ed68FaCf39B8A0ba77DCA45cA9A5A7C - Locate GME lending pool (ERC-4626)
Robinhood Chain: 0xCdb6Acf9Bbe5b7A43831b5F37B3f38277a942250 - Locate COIN lending pool (ERC-4626)
Robinhood Chain: 0x7b2Ba34f85E3833D7ae6Dd14428f3b3c598D307D - Locate MSTR lending pool (ERC-4626)
Robinhood Chain: 0x3d5109C1DE099FE0a860B05061C702cb57cB7641 - Locate AMD lending pool (ERC-4626)
Robinhood Chain: 0x01379341c1e789BFEf35c4f24C5Fcb8E02C586F5 - Locate AMZN lending pool (ERC-4626)
Robinhood Chain: 0x8A4C517645E0A3CE3fF4EBA24DbEACB9f560a315 - Locate NFLX lending pool (ERC-4626)
Robinhood Chain: 0x69a4BcE115b3587B71B5461B3c7209FA8718eD21 - Locate PLTR lending pool (ERC-4626)
Robinhood Chain: 0xCE02fB10cE315f19f2E6ED417C2C383A51776e92 - Locate TSLA lending pool (ERC-4626)
Robinhood Chain: 0xA93f7BF760e4E4947a2151b38D22407f3c48fE1D - Uniswap v3 factory (testnet deployment used by the router)
Robinhood Chain: 0xB72704f3759077Df559725057c1212f47af27e4D - Uniswap v3 SwapRouter
Robinhood Chain: 0x27487997EB47991c1b9C7DA4A9591C0cAdBAee41 - LiquiditySeeder
Arbitrum Sepolia: 0x965745066f15A0aeaFC42b291433B6362c9c0B97 - Locate NVDA lending pool
Arbitrum Sepolia: 0xad7baF95878D335323A9E666F44bDa48F1D0846C - Locate SPY lending pool
Arbitrum Sepolia: 0x793F4046C51F18f1978BD509E794e30825D31334 - Locate AAPL lending pool
Arbitrum Sepolia: 0x674417cf60251EFCbFDB09A790127d2F6543C284 - Locate MSFT lending pool
Arbitrum Sepolia: 0xf6F49b3D7940af9C2a757FeF789C84b756488f7C - Locate GOOGL lending pool
Arbitrum Sepolia: 0x1CCbbc30aD26D481816BEfF4d194d134Cd353a2B - Locate META lending pool
Arbitrum Sepolia: 0x45df8Dc662f077B5FC0bb79869a90e22931c99a0 - Locate GME lending pool
Arbitrum Sepolia: 0x8B13487833c166d2bb318cec8a0771E882f67616 - Locate COIN lending pool
Arbitrum Sepolia: 0xD17B058649f3aa92b3ea91280C2BCAEA40b63cD7 - Locate MSTR lending pool

## Wallet information

Deployer and protocol owner on both testnets: 0x610FdB41DA83138615C317c89fd9EB09271a46fe

## Additions

Public borrow-rate feed from the indexer at https://locate-indexer.adilhusain.xyz/markets; threat model and self-audit checklist in `docs/threat-model.md`; the full plan with the day-by-day record in `docs/plan.md`.
