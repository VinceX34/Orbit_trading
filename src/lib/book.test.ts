import assert from "node:assert/strict";
import test from "node:test";
import { assignTradeNumbers, deriveDesk } from "./book.ts";
import { defaultFlow } from "./flows.ts";
import type { Decision } from "./types.ts";

function decision(partial: Partial<Decision> & Pick<Decision, "executionId" | "startedAt">): Decision {
  return {
    analysisNo: null,
    flowId: "orbit-kraken",
    status: "success",
    pair: "ten",
    action: "hold",
    aiAction: null,
    reason: "Round.",
    thesis: "Thesis.",
    invalidation: null,
    mood: "calm",
    confidence: null,
    blockedByRule: null,
    order: null,
    equityQuote: 209.47,
    dayPnlPct: -1,
    inPosition: false,
    coins: [],
    ...partial,
  };
}

test("a limit fill and a later close become one numbered trade linked to both rounds", () => {
  const flow = defaultFlow();
  const openRound = decision({
    executionId: "ex-open",
    startedAt: "2026-11-22T12:00:00.000Z",
    coins: [
      {
        symbol: "ETH",
        pair: "ETHUSDC",
        action: "long",
        aiAction: "long",
        confidence: 0.7,
        line: "Pullback.",
        invalidation: "Below the swing.",
        setup: "Trend pullback on the 4h.",
        setupType: "trend_pullback",
        side: "long",
        entry: 1714.54,
        stop: 1651.76,
        target: 1868.49,
        sizePct: 41,
        pnlPct: null,
        r: null,
        note: "Limit order resting at 1714.54 until 19:38.",
        blockedByRule: null,
        order: { type: "limit", side: "buy", volume: "0.05", txid: "LIMIT1" },
        inPosition: false,
      },
    ],
  });
  const fillRound = decision({
    executionId: "ex-fill",
    startedAt: "2026-11-22T13:00:00.000Z",
    coins: [
      {
        symbol: "ETH",
        pair: "ETHUSDC",
        action: "hold",
        aiAction: "hold",
        confidence: 0.4,
        line: "Filled.",
        invalidation: "",
        setup: "Trend pullback on the 4h.",
        setupType: "trend_pullback",
        side: "long",
        entry: 1714.54,
        stop: 1651.76,
        target: 1868.49,
        sizePct: null,
        pnlPct: 0,
        r: 0,
        note: "The limit order filled at 1714.54.",
        blockedByRule: null,
        order: null,
        inPosition: true,
      },
    ],
  });
  const closeRound = decision({
    executionId: "ex-close",
    startedAt: "2026-11-22T16:00:00.000Z",
    coins: [
      {
        symbol: "ETH",
        pair: "ETHUSDC",
        action: "close",
        aiAction: "hold",
        confidence: 0.4,
        line: "Target.",
        invalidation: "",
        setup: "",
        setupType: "trend_pullback",
        side: "long",
        entry: 1714.54,
        stop: 1714.54,
        target: 1868.49,
        sizePct: null,
        pnlPct: 2,
        r: 1.1,
        note: "Closed near 1750.00: +2.07% on the price, about +0.87% after fees.",
        blockedByRule: "target_hit",
        order: { type: "market", side: "sell", volume: "0.05", txid: "CLOSE1" },
        inPosition: false,
      },
    ],
  });
  const derived = deriveDesk({ flow, decisions: [closeRound, openRound, fillRound], book: { positions: {}, pending: {}, history: [] } });
  const eth = derived.trades.find((trade) => trade.openAnalysisId === "ex-open");
  assert.ok(eth);
  assert.equal(eth.status, "closed");
  assert.equal(eth.closeAnalysisId, "ex-close");
  assert.equal(eth.entry, 1714.54);
  assert.equal(derived.positions.length, 0);
  const numbered = assignTradeNumbers(derived.trades, []);
  assert.equal(numbered.find((trade) => trade.id === eth.id)?.tradeNo, 9);
});

test("an open static position stays open and a resting order is not a trade", () => {
  const flow = defaultFlow();
  const derived = deriveDesk({
    flow,
    decisions: [],
    book: {
      positions: {
        ETHUSDC: { side: "long", volume: 0.05, entry: 1700, stop: 1650, target: 1800, openedAt: 1795300000, setupType: "breakout", txid: "L1" },
      },
      pending: {
        SOLUSDC: { side: "short", limit: 70, volume: 1, stop: 73, target: 64, placedAt: 1795360000, expireAt: 1795363300, txid: "P1" },
      },
      history: [],
    },
  });
  assert.equal(derived.positions.length, 1);
  assert.equal(derived.positions[0].symbol, "ETH");
  assert.equal(derived.positions[0].side, "long");
  assert.equal(derived.resting.length, 1);
  assert.equal(derived.resting[0].symbol, "SOL");
  assert.equal(derived.trades.some((trade) => trade.pair === "SOLUSDC"), false);
});

test("numbers already given to a trade stay put", () => {
  const flow = defaultFlow();
  const derived = deriveDesk({ flow, decisions: [], book: null });
  const first = assignTradeNumbers(derived.trades, []);
  const again = assignTradeNumbers(derived.trades, first.map((trade) => ({ id: trade.id, tradeNo: trade.tradeNo })));
  assert.deepEqual(
    again.map((trade) => [trade.id, trade.tradeNo]),
    first.map((trade) => [trade.id, trade.tradeNo]),
  );
  assert.equal(first.length, 8);
  assert.equal(first[0].tradeNo, 1);
});
