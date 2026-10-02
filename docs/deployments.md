# Deployments

Addresses are written by `contracts/script/DeployTestnet.s.sol` to `contracts/deployments/<chainid>.json`.

| Network | Chain id | Status |
|---|---|---|
| Robinhood Chain testnet | 46630 | not deployed yet: the deployer needs testnet ETH from https://faucet.testnet.chain.robinhood.com/. Use https://robinhood-sepolia-rpc.publicnode.com or https://robinhood-testnet.drpc.org for Stylus activation checks; the official public RPC refuses them. |
| Arbitrum Sepolia | 421614 | not deployed yet |
| Robinhood Chain mainnet | 4663 | read-only (fork tests and the price mirror) |

Deployer address (throwaway key, kept in the VPS `.env` only): `0x500FD8eD217C8dF1E458630489D8D80B443784F1`
Keeper address (throwaway key, kept in the VPS `.env` only): `0x319a9B7EA619Dd52c799209c111A5c348c9a3957`

Mainnet references used by the mirror and fork tests: USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, USDG/USD feed `0x61B7e5650328764B076A108EFF5fa7282a1B9aD2`, the 35 equity feeds and 194 Stock Tokens in `packages/sdk/registry/robinhood-mainnet.json`.
