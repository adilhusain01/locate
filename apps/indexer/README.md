# Locate indexer

Ponder 0.17 indexer over the Controller, the lending pools, the ShortRouter and the Liquidator, from the deployment block. Tables: markets, fee accruals, accounts, positions, lenders, activity. Endpoints: `/graphql` (GraphQL), `/sql/*` (Ponder SQL client) and `/markets`, a public JSON feed of every market's latest fee index and credited lender USDG.

Local:

```bash
pnpm dev          # PGlite database in .ponder/, GraphQL at http://localhost:42069/graphql
```

Production uses `ponder start`, which needs a schema name (`DATABASE_SCHEMA=locate`; the unit sets it). Without `DATABASE_URL` it runs on PGlite, which is fine for the testnet; a Neon Postgres URL in `.env` switches it to Postgres.

## On the VPS

1. DNS at Namecheap: `locate-indexer.adilhusain.xyz` A `13.140.56.191`, AAAA `2400:d321:2360:5616::1`.
2. Service, as root:

```bash
cp /root/Projects/locate/apps/indexer/deploy/locate-indexer.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now locate-indexer
curl -s http://127.0.0.1:42069/markets | head -c 300
```

3. Caddy: back up `/etc/caddy/Caddyfile`, append `deploy/Caddyfile.snippet` to it, then `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`. The file's `default_bind` already limits the site to the public addresses. Do not add CORS headers in Caddy: Ponder sends `Access-Control-Allow-Origin: *` itself, and a second copy makes the header read `*, *`, which browsers reject.
4. Tell the app: `vercel env add NEXT_PUBLIC_INDEXER_URL production` with `https://locate-indexer.adilhusain.xyz`, then redeploy. The auctions page and the activity views pick it up.

Logs: `/var/log/locate-indexer.log`. Resync from scratch: stop the service, delete `.ponder/`, start it again (a few minutes on testnet).
