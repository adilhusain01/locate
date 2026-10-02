# Decisions

Dated record of the calls made while building Locate, with the reason for each. Newest at the bottom.

## 2026-10-02

- Name: Locate. A locate is what a trader needs before shorting a stock.
- Solidity toolchain: Foundry. Fuzz, invariant and fork tests are built in, `cast` talks to Stylus contracts, and OpenZeppelin 5.4 is pulled in as a submodule. Hardhat 3 would have worked but offers nothing extra here.
- Wallets: Privy. Judges and first users get an embedded wallet from an email login, external wallets still connect, and Privy is one of the account abstraction providers Robinhood Chain documents. RainbowKit is only a connector UI.
- Networks: testnet only. The protocol deploys to Robinhood Chain testnet (46630) with an Arbitrum Sepolia mirror. Mainnet (4663) is touched read-only: fork tests and the price mirror. Chainlink equity feeds exist only on mainnet, the testnet has several unofficial USDG tokens and Uniswap deployments but no canonical ones, so the testnet gets our own MockUSDG, our own Uniswap v3 deployment and MockFeeds that a keeper fills with the mainnet Chainlink prices and timestamps.
- Fees: charged in USDG. Lenders earn cash yield, borrowers pay out of their USDG collateral and a short stays a fixed number of shares. The cost is a per-market USDG reward index in each pool plus an hourly accrual poke from a keeper; debt in raw units never grows.
- Team: solo, with Claude Code doing the implementation across Solidity, Rust and TypeScript, and an outside reviewer for the Stylus and liquidation code before any mainnet. A Rust partner would mostly cost a prize split now that the Rust work is not the bottleneck.
- Scope: the full 21-day build. Not entered into the Singapore edition that closes on 4 October 2026; aimed at the next Open House and the grant track.
- Accounting: raw units everywhere, ERC-4626 with a decimals offset of 6 and a revert on zero-share deposits, flash loans at 5 basis points rounded up, utilisation capped at 90 percent for borrows only.

## 2026-10-02, later

- Testnet tokens: the Robinhood testnet has no canonical registry and its faucet page rate-limits scripted access, and the tokens that look official on the explorer are community mocks (one carries `uiMultiplier` but is not a beacon proxy and does not support ERC-165). Locate therefore deploys its own MockStockTokens on testnet, named "(Locate testnet mock)", priced from the live mainnet Chainlink feeds. Real faucet tokens can be listed later with the same scripts.
- Pool depth on testnet: each market's Uniswap v3 pool is seeded with 1,000,000 mock USDG a side so a ten-share short moves the pool well under one percent and the demo numbers read cleanly.
- Fee of the flash leg: the pool's own 5 basis point flash loan funds liquidations, so liquidators need no capital and lenders earn the fee. `LendingPool.borrow` and `repay` are controller-only and follow checks-effects-interactions, so they carry no reentrancy guard; `flashLoan` and `claim` do.
- Deferred checks: a short counts its own proceeds as margin because `borrowWithCallback` checks the initial ratio after the receiver's callback. `depositCollateral` and `repay` are the only state-changing calls allowed inside a callback.
- Oracle pause flag: on mainnet the `oraclePaused()` and `paused()` flags live on the Stock Token itself, not on the Chainlink proxy (the proxy reverts). The router reads them from the token with tolerant static calls.
- Live token detail: `newUIMultiplier()` and `effectiveAt()` keep returning the last scheduled values after they take effect (read from mainnet NVDA), so "pending" means `effectiveAt()` is in the future. The mock mirrors this.
