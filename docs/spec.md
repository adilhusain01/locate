# Locate protocol specification

The precise behaviour the contracts implement and the tests check. Sections are referenced from the test files.

## Units

- Stock tokens have 18 decimals. All debt and lender accounting is in raw units; the ERC-8056 multiplier is only read for display.
- USDG has 6 decimals. Fees, collateral, auction payouts and insurance are USDG units.
- Prices are USD per whole token in 1e18 fixed point (WAD). Robinhood Chain Chainlink feeds already include the multiplier, so the price of one raw token is the feed answer scaled from 8 to 18 decimals.
- Rates are yearly, in WAD. A year is 365 days.

## LendingPool

One ERC-4626 vault per stock token with a decimals offset of 6. `totalAssets` is idle balance plus `totalBorrows`. Only the Controller may `borrow`, `repay`, `writeOff` and `notifyReward`. Borrows may not take utilisation above `maxUtilisation` (90 percent); lender withdrawals are limited by idle liquidity. A deposit that would mint zero shares reverts. Flash loans of the asset cost 5 basis points rounded up and the fee stays in the pool. USDG rewards are tracked per share with 1e36 precision, settle on every share transfer and are paid out by the Controller on `claim`.

## Controller

Accounts hold one USDG collateral balance. Markets are listed by the owner with a pool, an initial ratio (at least the liquidation threshold, which is at least 1.0), Dutch auction bounds, a borrow cap and an interest curve.

Borrowing requires: a listed market with borrows not paused, `oracle.borrowAllowed(token)`, room under the borrow cap, and collateral value of at least the sum of debt value times initial ratio after the borrow. Collateral value is `(collateral - pending fees) x USDG price`.

Fees: each market keeps `feeIndex`, the cumulative USD owed per whole token borrowed. On accrual, `feeIndex` grows by `price x rate(utilisation) x elapsed / year`. Lenders are credited `totalDebtRaw x delta` at once (90 percent through `pool.notifyReward`, 10 percent to `insuranceBalance`). Each position remembers the index at its last settlement; settlement charges `debtRaw x (feeIndex - snapshot)` against collateral whenever the account is touched, and records any shortfall as `unpaidFees`.

Health factor is `collateral value / sum(debt value x liquidation threshold)`, unlimited with no debt.

Liquidation requires health below 1. The first liquidation starts an auction; the discount runs linearly from `dutchMin` to `dutchMax` over `dutchDuration` and then holds. The close factor is 50 percent of that market's position, or 100 percent when health is below 0.95. The liquidator pays raw units and receives `repaid x price x (1 + discount) / USDG price`, capped by the account's collateral, and may set a minimum. The auction clears when health is back at or above 1 after a liquidation or repayment.

Absorb: once an account has no collateral left, anyone may absorb it. For each remaining position the pool writes the raw units off and lenders are compensated from insurance in USDG up to the debt's value; unpaid fees are also covered from insurance as far as it goes.

Operators and deferred checks: an account may approve operators. `borrowWithCallback` hands borrowed tokens to a receiver, calls `onLocateBorrow`, then checks the initial ratio. `withdrawWithCallback` does the same for USDG with `onLocateWithdraw`. `depositCollateral` and `repay` are callable inside those callbacks; `borrow`, `withdrawCollateral`, `liquidate`, `absorb` and the callback functions themselves are reentrancy guarded.

## OracleRouter

`quote(token)` returns the Chainlink price scaled to WAD, the print's timestamp and a regime: Paused when the token's `oraclePaused()` or `paused()` is true, the sequencer feed is down or has been back for less than the grace period; Closed when the market calendar says the 24/5 session is closed; Degraded when the session is open but the print is older than heartbeat plus one hour; otherwise Open. `borrowAllowed` is false in Paused and Degraded and in the last 30 minutes before the session opens. `usdgPriceWad` is min(1, USDG/USD feed), or 1 with no feed, a stale feed or a broken feed. The Stylus router adds the pool TWAP, the band around the last print and the max-of-sources valuation.

## MarketCalendar

Session day D runs from D-1 20:00 ET to D 20:00 ET and is open when D is a weekday and not a holiday. Eastern Time is UTC-4 from the second Sunday of March 02:00 to the first Sunday of November 02:00, else UTC-5. `nextOpen`, `closedFor` and the holiday list support the regime logic and the pre-open guard.

## ShortRouter and Liquidator

ShortRouter is an operator. `short` borrows through `borrowWithCallback`, sells on the caller's Uniswap path with a minimum out and deposits the proceeds for the account before the ratio check. `cover` withdraws up to a maximum through `withdrawWithCallback`, buys the exact raw amount back, repays and redeposits the change. Liquidator flash-borrows the tokens from their own pool, calls `liquidate`, buys back what was used plus the flash fee with the USDG received, and sends the difference to the caller, reverting below a minimum profit.

## Invariants to hold under any sequence of actions

- Pool assets equal idle balance plus outstanding borrows.
- No action other than a price move or fee accrual takes an account from health at least 1 to below 1.
- Raw-unit accounting never changes on a multiplier update.
- Controller USDG balance is at least the sum of account collateral plus unclaimed lender rewards plus insurance, minus unpaid fees not yet absorbed.
