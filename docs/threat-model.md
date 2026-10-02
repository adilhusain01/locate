# Threat model and self-audit checklist

What can go wrong, what the contracts do about it, and what to check before any mainnet deployment. Tick items when a reviewer has confirmed them against the code, not the intent.

## Assets at risk

- Lenders' stock tokens in the pools (raw units, plus the ERC-8056 multiplier they carry).
- Borrowers' USDG collateral in the Controller.
- Unclaimed lender rewards and the insurance balance, both USDG held by the Controller.

## Threats and controls

| Threat | Control | Where | Checked |
|---|---|---|---|
| Oracle manipulation on a thin weekend pool | Debt valued at the higher of the Chainlink print and the pool TWAP clamped to a band around it; borrow caps tied to pool depth; pre-open guard; TWAP window 30 minutes | Stylus oracle router, Controller params | |
| Stale or paused feed | Degraded regime after heartbeat plus grace; Paused regime from the token's own `oraclePaused()` and `paused()` flags and the sequencer feed; no new borrows in either, repay and withdraw always open | OracleRouter | |
| Sequencer outage | Grace period after recovery before quotes count as healthy | OracleRouter | |
| Reentrancy through flash loans and router callbacks | `nonReentrant` on `flashLoan`, `claim`, `borrow`, `withdrawCollateral`, `liquidate`, `absorb` and the deferred-check functions; `depositCollateral` and `repay` only improve an account; pools' `borrow` and `repay` are controller-only and follow checks-effects-interactions | LendingPool, Controller | |
| Deferred-check abuse (acting while a borrow is in flight) | Health and the utilisation cap are checked at the end of every entry point, so nested actions cannot escape the final check | Controller | |
| ERC-4626 inflation attack | Decimals offset of 6, revert on zero-share deposits, first deposit made by the deployer | LendingPool | |
| Rounding in favour of users | Debt rounds up, health rounds down, flash fee rounds up, share conversions use OpenZeppelin's rounding | RiskMath, LendingPool | |
| Decimals mix-ups (6, 8, 18) | USDG scale fixed in the Controller constructor, feed decimals read at `setFeed`, markets must have 18 decimals | Controller, OracleRouter | |
| Counterfeit stock tokens | Listing is owner-only; the registry puller verifies the shared implementation; names are never trusted | MarketFactory (deployer script), scripts | |
| Issuer actions (pause, multiplier) | Paused regime; raw-unit accounting makes multiplier changes a no-op for the protocol | OracleRouter, everywhere | |
| Bad debt | Liquidation thresholds above initial ratios; Dutch auction discount up to 12 percent; insurance fund first, then a pro-rata lender haircut, both on the Markets page | Controller | |
| Admin key compromise | Owner behind a multisig and timelock before mainnet; guardian limited to pausing borrows and listings, never withdrawals or liquidations | Deployment plan | |
| Keeper failure | Run records per tick, email alerts, two independent liquidation keepers planned | apps/keepers | |

## Self-audit checklist before mainnet

- [ ] Every external call in Controller and LendingPool listed with its trust level.
- [ ] All `onlyController`, `onlyOwner`, `onlyGuardianOrOwner`, operator and pool-callback checks enumerated and tested from an outsider address.
- [ ] Rounding direction stated per formula and matched by a test.
- [ ] Oracle regime transitions tested for each input (feed age, pause flags, sequencer, calendar).
- [ ] Liquidation payout never exceeds collateral; auction clears only at health above 1.
- [ ] Absorb path cannot be used while collateral remains.
- [ ] Invariant suite run at the CI profile (512 runs, depth 128) with no failures.
- [ ] Differential check of the Stylus engine and router against the Solidity reference on the target chain.
- [ ] Slither and Aderyn clean or every finding written down with a reason.
- [ ] Deployment addresses and parameters reviewed against `docs/deployments.md`.
- [ ] Outside review of the Stylus and liquidation code completed and findings fixed.
