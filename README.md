# Orbit

A local desk for an n8n round that looks at ten Kraken spot pairs against euro. The model writes why it buys, sells, or waits on each coin. A hard gate in the workflow may override that. This app turns the workflow on or off and keeps the log.

The app does not start the round. n8n does that itself, every hour at two minutes past, once the workflow is published.

## Start

```bash
npm install
npm run dev
```

The app listens on http://127.0.0.1:3000. The desk asks for `DESK_PASSWORD` before it opens.

`.env.local` holds the workflow id, that password, and `DATABASE_URL` from the Neon connection on Vercel. Fill in `N8N_API_KEY`. Create the key in n8n under Settings, API. Scopes: `workflow:read`, `workflow:activate`, `execution:list`, `execution:read`, `execution:reveal`.

## What you still connect

The flow is named **Orbit** and stays unpublished until the switch flips: [Orbit](https://vincex34.app.n8n.cloud/workflow/BqMqaNPVxkVTT3Tt).

The **Orbit** node uses the credential **OpenAi account**, model `gpt-5.4`. Without a working OpenAI key the round writes `model_offline` and no order goes out.

Kraken, later, as two n8n variables. The names must be exact:

- `KRAKEN_API_KEY`
- `KRAKEN_API_SECRET`

Permissions on that key: Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, Create & Modify Orders, Cancel/Close Orders. No Withdraw.

Without those variables Orbit only reads the public prices and writes wait. No order goes out.

## The ten lanes

BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX, DOT and LTC, all against euro. The list lives on the Desk Config node.

At most one position per coin, and only volume Orbit bought itself. A buy is at most 15 euro. Balance that was already on Kraken stays put.

Plus 1% on this desk's equity is the line. Above it, no new buy. Below −0.5%, no new buy either. An open position may still be closed. Equity is free euro plus Orbit's own holdings, not the whole Kraken account.

A first hour can deploy up to ten times 15 euro if the gate lets every buy through.
