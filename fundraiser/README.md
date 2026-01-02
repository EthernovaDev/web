# Fundraiser Page

This folder contains the static fundraiser page for https://ethnova.net/fundraiser/.

## Config
All runtime settings live at the top of `fundraiser/app.js` in the `CONFIG` object:

- `TRON_ADDRESS`
- `GOAL_USDT`
- `LAUNCH_DATE_UTC`
- `DEADLINE_DAYS`
- `USDT_CONTRACT_TRON`
- `API_BASE`
- `API_BASES`
- `API_MODE` (`direct` or `proxy`)
- `PROXY_BASE`
- `TRANSFERS_PATH`
- `FALLBACK_PATH`
- `PROXY_TRANSFERS_PATH`
- `PRIMARY_QUERY_MODE`
- `FALLBACK_QUERY_MODE`
- `FALLBACK_CONFIRM`
- `TRONSCAN_WALLET_URL`
- `TRONSCAN_TX_URL`
- `REFRESH_SECONDS`
- `MAX_TX_SCAN`
- `SHOW_DONOR_ADDRESSES`
- `DONATIONS_LIST_LIMIT`
- `DEBUG_ENABLED`
- `KNOWN_TX_HASHES`

To change the fundraiser schedule, update `LAUNCH_DATE_UTC` and/or `DEADLINE_DAYS`.

## CORS / Proxy
The page uses public TronScan endpoints. If the browser blocks requests due to CORS:

- Set `API_MODE` to `proxy` and `PROXY_BASE` to your proxy base URL.
- The UI will show a banner if live data is temporarily unavailable.
- `API_BASES` controls the direct fallback order; the first working base will be used.

## Cloudflare Worker
Use the included `worker/` folder to create a proxy that adds the TronScan API key. The worker exposes:

- `/health`
- `/trc20/transfers` (primary for the frontend)
- `/api/token_trc20/transfers` (alias)

### Secure Deployment (copy/paste)
Do NOT commit your API key anywhere (no JS/HTML/README). The key must only live in Wrangler secrets.

1) Install Wrangler (if not installed):
   `npm i -g wrangler`

2) Authenticate:
   `wrangler login`

3) From the worker folder:
   `cd C:\dev\ethernova-web\worker`

4) Set the secret (exact name required):
   `wrangler secret put TRONSCAN_API_KEY`
   (paste your TronScan API key when prompted)

5) Deploy:
   `wrangler deploy`

6) Wrangler prints a Worker URL like:
   `https://<worker-name>.<account>.workers.dev`
   Paste it into `PROXY_BASE` in `fundraiser/app.js`.
   The frontend calls `${PROXY_BASE}/trc20/transfers`.

### Test Commands
Use these to validate the proxy after deploy:

- `curl https://<worker-name>.<account>.workers.dev/health`
- `curl "https://<worker-name>.<account>.workers.dev/trc20/transfers?start=0&limit=20&confirm=0&direction=in&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&relatedAddress=TVYT4XtYtnBEg5VnKNUnx1n8oUeZ8mq2Lg"`

## Debugging
The fundraiser page has a diagnostics panel and a dedicated debug page:

- `/fundraiser/debug.html` (do not share publicly).
- To show the debug link in the UI, append `?debug=1` or set `DEBUG_ENABLED` to `true`.
- Use the debug page to inspect raw API responses and search for specific tx hashes.
- The debug page uses its own config in `fundraiser/debug.js`.

## GitHub Pages
Place this folder at the repo root. GitHub Pages will serve it at:

https://ethnova.net/fundraiser/

No build step is required.
