# Orbit

Lokaal bureau voor een n8n-ronde die tien spotparen tegen euro op Kraken bekijkt. Het model schrijft waarom het per coin koopt, verkoopt of wacht. Een harde poort in de workflow mag dat overrulen. Deze app zet de workflow aan of uit en bewaart het logboek.

De app start de ronde niet. n8n doet dat elk uur zelf, twee minuten over het uur, zodra de workflow gepubliceerd is.

## Starten

```bash
npm install
npm run dev
```

De app luistert op http://127.0.0.1:3000.

`.env.local` heeft het workflow-id. Vul `N8N_API_KEY`. Maak de key in n8n onder Settings, API. Scopes: `workflow:read`, `workflow:activate`, `execution:list`, `execution:read`, `execution:reveal`.

## Wat jij nog koppelt

De flow heet **Orbit** en blijft unpublished tot de schakelaar omgaat: [Orbit](https://vincex34.app.n8n.cloud/workflow/BqMqaNPVxkVTT3Tt).

Op de node **Orbit** hangt de credential **OpenAi account**, model `gpt-5.4`. Zonder werkende OpenAI-key schrijft de ronde `model_offline` en gaat er geen order uit.

Kraken, later, als twee n8n-variabelen. De namen moeten exact zo zijn:

- `KRAKEN_API_KEY`
- `KRAKEN_API_SECRET`

Rechten op die key: Query Funds, Query Open Orders & Trades, Query Closed Orders & Trades, Create & Modify Orders, Cancel/Close Orders. Geen Withdraw.

Zonder die variabelen leest Orbit alleen de publieke koersen en schrijft hij wachten. Er gaat geen order uit.

## De tien banen

BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX, DOT en LTC, allemaal tegen euro. De lijst staat in de node Desk Config.

Hooguit één eigen stuk per coin. Een koop is maximaal 15 euro. Orbit verkoopt alleen volume dat hij zelf heeft gekocht. Bestaand saldo op Kraken blijft liggen.

Plus 1% op het vermogen van dit bureau is de streep. Daarboven geen nieuwe koop. Onder −0,5% ook niet. Een eigen stuk mag dan nog wel dicht. Het vermogen is de vrije euro plus de eigen stukken, niet je hele Kraken-rekening.

Een eerste uur kan tot tien keer 15 euro inzetten als de poort ze allemaal doorlaat.
