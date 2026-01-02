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
- `TRONSCAN_WALLET_URL`
- `TRONSCAN_TX_URL`
- `OPTIONAL_PROXY_BASE`
- `REFRESH_SECONDS`
- `MAX_TX_SCAN`
- `SHOW_DONOR_ADDRESSES`
- `DONATIONS_LIST_LIMIT`

To change the fundraiser schedule, update `LAUNCH_DATE_UTC` and/or `DEADLINE_DAYS`.

## CORS / Proxy
The page uses public TronScan endpoints. If the browser blocks requests due to CORS:

- Set `OPTIONAL_PROXY_BASE` to your proxy base URL.
- The UI will show a banner if live data is temporarily unavailable.

## GitHub Pages
Place this folder at the repo root. GitHub Pages will serve it at:

https://ethnova.net/fundraiser/

No build step is required.
