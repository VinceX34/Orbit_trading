# Orbit

A local desk for an n8n round that reads ten Kraken pairs against USDC and trades both directions. The model picks its own setups, long or short, with a stop and a target per trade. A hard gate in the workflow may override that. This app turns the workflow on or off and keeps the log.

The app does not start the round. n8n does that itself, every hour at two minutes past, once the workflow is published.

## Start

```bash
npm install
npm run dev
```

The app listens on http://127.0.0.1:3000. The desk asks for `DESK_PASSWORD` before it opens.

`.env.local` holds the workflow id, that password, and `DATABASE_URL` from the Neon connection on Vercel. Fill in `N8N_API_KEY`. Create the key in n8n under Settings, API. Scopes: `workflow:read`, `workflow:update`, `workflow:activate`, `execution:list`, `execution:read`, `execution:reveal`.

## What you still connect

The flow is named **Orbit** and stays unpublished until the switch flips: [Orbit](https://vincex34.app.n8n.cloud/workflow/BqMqaNPVxkVTT3Tt).

The **Orbit** node uses the credential **OpenAi account**, model `gpt-5.6-luna`. Without a working OpenAI key the round writes `model_offline` and no order goes out.

The Kraken key and secret live in the n8n data table `orbit_kraken`. Permissions on that key: Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, Create & Modify Orders, Cancel/Close Orders. No Withdraw. Shorts run on Kraken margin with the same key, so margin trading must be enabled on the account.

Without the keys Orbit only reads the public prices and writes wait. No order goes out.

## The rules

BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX, DOT and LTC, all against USDC. All numbers below live on the Desk Config node.

- At most two positions at once, each at most 45% of desk equity. Desk equity is free USDC plus Orbit's own positions, not the rest of the Kraken account.
- A long is a spot buy. A short is a margin sell at 2x leverage. AVAX/USDC has no margin on Kraken, so AVAX is long only.
- Every opening carries a real stop-loss order on Kraken, at most 1.5% and at least 0.3% from the price.
- The target must pay the round-trip fee. The desk closes the position in the first round after the price touches it.
- Conviction below 0.62 opens nothing.
- Above +1% or below −3% on the day, no new position. Closing is always allowed.

## Changing the workflow

`n8n/orbit.js` is the source of the workflow code. `node n8n/sync.mjs` writes the code, the prompt and Desk Config into the live workflow without touching the model choice or the publish switch. `--dry` only checks that everything parses.
