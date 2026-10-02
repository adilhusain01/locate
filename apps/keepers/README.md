# Locate keepers

Three long-running jobs per deployment. Each writes a run record per tick to `runs/<job>.jsonl` (successes and failures with their inputs) and keeps small state in `runs/state-<job>.json`. `CHAIN_ID` selects the deployment (46630 Robinhood Chain testnet by default, 421614 Arbitrum Sepolia).

| Job | What it does | Interval |
|---|---|---|
| `price-mirror` | copies the mainnet Chainlink prints (answer and timestamp) into the testnet mock feeds, REST mid for tickers without a feed, plus USDG/USD | 5 min |
| `liquidator` | learns borrowers from `Borrowed` events, checks health, flash-liquidates below 1 when the simulated profit clears `MIN_PROFIT_USDG`, absorbs accounts with no collateral left | 10 s |
| `monitor` | regimes and print ages, mirror lag, sequencer health, keeper gas, stuck auctions, and an hourly `accrue` poke per market with debt; alerts by email when `RESEND_API_KEY` and `ALERT_EMAIL` are set | 5 min |

Run once from the repo root environment:

```bash
set -a && . ./.env && set +a
cd apps/keepers
node src/price-mirror.ts --once
node src/liquidator.ts --once
node src/monitor.ts --once
```

Environment: `KEEPER_PRIVATE_KEY` (falls back to `DEPLOYER_PRIVATE_KEY`), `ROBINHOOD_TESTNET_RPC_URL`, `ARBITRUM_SEPOLIA_RPC_URL`, `ROBINHOOD_RPC_URL`, optional `CHAIN_ID`, `RPC_URL`, `MIN_PROFIT_USDG`, `RESEND_API_KEY`, `ALERT_EMAIL`.

## Running them on the VPS

The unit files in `systemd/` run each job under systemd with logs in `/var/log/locate-<job>.log`. Install and start them as root:

```bash
cp /root/Projects/locate/apps/keepers/systemd/*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now locate-price-mirror locate-liquidator locate-monitor
systemctl status locate-price-mirror locate-liquidator locate-monitor
```

For a second deployment, copy a unit, change `CHAIN_ID` and the description, and give it another name.
