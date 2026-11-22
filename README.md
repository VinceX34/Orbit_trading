# Orbit

A local desk for an n8n round that reads ten Kraken pairs against USDC and trades both directions. The model picks its own setups, long or short, with a stop and a target per trade. A hard gate in the workflow may override that. This app turns the workflow on or off and keeps the log.

n8n starts the round itself, every hour at two minutes past, once the workflow is published. **Run now** in the app publishes the workflow and starts a round right away through the `Run Now` webhook, guarded by `ORBIT_RUN_TOKEN`.

## Start

```bash
npm install
npm run dev
```

The app listens on http://127.0.0.1:3000. The desk asks for `DESK_PASSWORD` before it opens.

The desk is split by exchange. A flow is one n8n workflow linked to one exchange, and each flow has its own on/off switch. Orbit on Kraken is the first. Another broker is another exchange with its own flow. Dashboard, open positions, analysis and the trade log are separate pages. Each round is an analysis id (`A-001`). Each fill is a trade number, linked to the round that opened it and the round that closed it. Light, dark and system live under Settings, in this browser.

`.env.local` holds the workflow id, that password, and `DATABASE_URL` from the Neon connection on Vercel. Fill in `N8N_API_KEY`. Create the key in n8n under Settings, API. Scopes: `workflow:read`, `workflow:update`, `workflow:activate`, `execution:list`, `execution:read`, `execution:reveal`.

## What you still connect

The flow is named **Orbit** and stays unpublished until the switch flips: [Orbit](https://vincex34.app.n8n.cloud/workflow/BqMqaNPVxkVTT3Tt).

The **Orbit** node uses the credential **OpenAi account**, model `gpt-5.6-luna`. Without a working OpenAI key the round writes `model_offline` and no new order goes out. The desk rules on open positions still run.

The Kraken key and secret live in the n8n data table `orbit_kraken`. Permissions on that key: Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, Create & Modify Orders, Cancel/Close Orders. No Withdraw. Shorts run on Kraken margin with the same key, so margin trading must be enabled on the account.

Without the keys Orbit only reads the public prices and writes wait. No order goes out.

## The rules

BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX, DOT and LTC, all against USDC. All numbers below live on the Desk Config node.

There is no daily limit on profit or loss. Every round has two phases.

**The book.** Each open position gets a review card: result in percent and in R (one R is the distance from entry to the first stop), best and worst so far, hours open, trend score at entry and now, the model's own thesis and invalidation, and a desk reading (healthy, weakening, broken). The model holds, tightens the stop, moves the target, or closes. The desk also acts by rule, even when the model is offline:

- Price touched the target: close.
- Best result reached +1R: the stop moves to the entry.
- Best result reached +1.5R: the stop trails two 4h ATRs behind the best price. Stops only ever tighten.
- 72 hours open and still under +0.5R: close.
- A stop order that is gone gets placed again.

**The hunt.** Only when a slot is free.

- At most two positions, resting orders included, each at most 45% of desk equity. A stop may cost at most 2% of desk equity, fees included, so a wide stop means a smaller position. Desk equity is free USDC plus Orbit's own positions, not the rest of the Kraken account.
- A long is a spot buy. A short is a margin sell at 2x leverage. AVAX/USDC has no margin on Kraken, so AVAX is long only.
- Entries are post-only limit orders at the model's entry price, valid for 55 minutes. That pays Kraken's maker fee instead of the taker fee. If the price does not come to the order, there is no trade.
- Every entry carries a real stop-loss order on Kraken, between 1.2 and 3.5 times the 4h ATR from the entry and never more than 6%.
- The target must pay: target distance minus fees is at least 1.3 times stop distance plus fees. Fees are read from the account's own recent trades.
- Conviction below 0.62 opens nothing.
- After a losing exit, the same side on the same coin is closed for six hours.

The dossier gives the model, per coin: a trend score across daily, 4h and 1h, EMAs, ATR, RSI on three timeframes, ADX, Bollinger position and squeeze, ranges, VWAP, volume against its average, swing highs and lows, strength against BTC, and its own last ten trades with the result after fees.

## Changing the workflow

`n8n/orbit.js` is the source of the workflow code. `node n8n/sync.mjs` writes the code, the prompt and Desk Config into the live workflow without touching the model choice or the publish switch. `--dry` only checks that everything parses.
