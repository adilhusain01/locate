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
