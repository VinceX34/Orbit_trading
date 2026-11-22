import { pairSymbol, type TradeFlow } from "./flows";
import type { CoinLane, Decision, PositionView, RestingOrder, StaticBook, StaticHistory, Trade, TradeDraft } from "./types";

type Live = {
  id: string;
  symbol: string;
  pair: string;
  side: string;
  status: "open" | "working";
  entry: number | null;
  stop: number | null;
  target: number | null;
  volume: number | null;
  sizePct: number | null;
  setupType: string | null;
  thesis: string | null;
  line: string | null;
  openedAt: string | null;
  openAnalysisId: string | null;
  txid: string | null;
  pnlPct: number | null;
  r: number | null;
};

const recorded: StaticHistory[] = [
  { symbol: "BTC", side: "short", setupType: "before the rebuild", grossPct: 4.36, netPct: 2.75, hours: 11, how: "closed by the desk", at: 0 },
  { symbol: "ETH", side: "short", setupType: "before the rebuild", grossPct: 1.83, netPct: 0.22, hours: 4, how: "closed by the desk", at: 0 },
  { symbol: "BTC", side: "long", setupType: "before the rebuild", grossPct: -0.52, netPct: -2.12, hours: 3.5, how: "stop on Kraken", at: 0 },
  { symbol: "SOL", side: "long", setupType: "before the rebuild", grossPct: -0.62, netPct: -2.22, hours: 3.6, how: "stop on Kraken", at: 0 },
  { symbol: "ETH", side: "short", setupType: "before the rebuild", grossPct: -1.5, netPct: -3.12, hours: 3.3, how: "stop on Kraken", at: 0 },
  { symbol: "XRP", side: "short", setupType: "before the rebuild", grossPct: -1.22, netPct: -2.84, hours: 2.5, how: "stop on Kraken", at: 0 },
  { symbol: "BTC", side: "short", setupType: "before the rebuild", grossPct: -1.26, netPct: -2.87, hours: 0.8, how: "stop on Kraken", at: 0 },
  { symbol: "ETH", side: "short", setupType: "before the rebuild", grossPct: -1.68, netPct: -3.29, hours: 0.8, how: "stop on Kraken", at: 0 },
];

function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function symbolFor(pair: string | null, symbol: string | null): string {
  if (symbol) return symbol;
  if (pair && pairSymbol[pair]) return pairSymbol[pair];
  return pair || "";
}

function emptyDraft(flow: TradeFlow, live: Live, decision: Decision | null, how: string): TradeDraft {
  const closedAt = decision?.startedAt ?? null;
  const hours =
    live.openedAt && closedAt ? (Date.parse(closedAt) - Date.parse(live.openedAt)) / 3600000 : null;
  return {
    id: live.id,
    flowId: flow.id,
    exchangeId: flow.exchangeId,
    symbol: live.symbol,
    pair: live.pair,
    side: live.side,
    status: "closed",
    entry: live.entry,
    exit: null,
    stop: live.stop,
    target: live.target,
    volume: live.volume,
    sizePct: live.sizePct,
    grossPct: null,
    netPct: null,
    r: live.r,
    hours: hours !== null && Number.isFinite(hours) ? hours : null,
    setupType: live.setupType,
    thesis: live.thesis,
    how,
    openedAt: live.openedAt,
    closedAt,
    openAnalysisId: live.openAnalysisId,
    closeAnalysisId: decision?.executionId ?? null,
    txid: live.txid,
  };
}

function fromCoin(flow: TradeFlow, decision: Decision, coin: CoinLane, status: "open" | "working"): Live {
  const pair = coin.pair || "";
  return {
    id: `round:${decision.executionId}:${pair}`,
    symbol: symbolFor(pair, coin.symbol),
    pair,
    side: coin.side || coin.action || "",
    status,
    entry: coin.entry,
    stop: coin.stop,
    target: coin.target,
    volume: num(coin.order?.volume),
    sizePct: coin.sizePct,
    setupType: coin.setupType,
    thesis: coin.setup,
    line: coin.line,
    openedAt: status === "open" ? decision.startedAt : null,
    openAnalysisId: decision.executionId,
    txid: coin.order?.txid || null,
    pnlPct: coin.pnlPct,
    r: coin.r,
  };
}

export function deriveDesk(input: {
  flow: TradeFlow;
  decisions: Decision[];
  book: StaticBook | null;
}): { trades: TradeDraft[]; positions: PositionView[]; resting: RestingOrder[] } {
  const { flow, book } = input;
  const decisions = [...input.decisions].sort((a, b) => (a.startedAt || "").localeCompare(b.startedAt || ""));
  const open = new Map<string, Live>();
  const closed: TradeDraft[] = [];

  function closeLive(pair: string, symbol: string, side: string, decision: Decision, exit: number | null, gross: number | null, net: number | null, how: string) {
    const live = open.get(pair);
    const base =
      live ??
      ({
        id: `round:${decision.executionId}:${pair}:exit`,
        symbol,
        pair,
        side,
        status: "open",
        entry: null,
        stop: null,
        target: null,
        volume: null,
        sizePct: null,
        setupType: null,
        thesis: null,
        line: null,
        openedAt: null,
        openAnalysisId: null,
        txid: null,
        pnlPct: null,
        r: null,
      } satisfies Live);
    const draft = emptyDraft(flow, base, decision, how);
    draft.exit = exit;
    draft.grossPct = gross;
    draft.netPct = net;
    draft.side = base.side || side;
    closed.push(draft);
    open.delete(pair);
  }

  for (const decision of decisions) {
    for (const coin of decision.coins) {
      const pair = coin.pair;
      if (!pair) continue;
      const note = coin.note || "";
      const symbol = symbolFor(pair, coin.symbol);
      const kraken = note.match(/Kraken closed this (long|short) at ([0-9]+(?:\.[0-9]+)?): ([+-][0-9]+(?:\.[0-9]+)?)% on the price, ([+-][0-9]+(?:\.[0-9]+)?)% after fees/i);
      const nearNew = note.match(/Closed near ([0-9]+(?:\.[0-9]+)?): ([+-][0-9]+(?:\.[0-9]+)?)% on the price, about ([+-][0-9]+(?:\.[0-9]+)?)% after fees/i);
      const nearOld = note.match(/Closed near ([0-9]+(?:\.[0-9]+)?), ([+-]?[0-9]+(?:\.[0-9]+)?)% from the entry/i);

      if (kraken) {
        closeLive(pair, symbol, kraken[1].toLowerCase(), decision, Number(kraken[2]), Number(kraken[3]), Number(kraken[4]), "stop on Kraken");
        continue;
      }
      if (nearNew) {
        closeLive(pair, symbol, coin.side || "", decision, Number(nearNew[1]), Number(nearNew[2]), Number(nearNew[3]), "closed by the desk");
        continue;
      }
      if (nearOld) {
        closeLive(pair, symbol, coin.side || "", decision, Number(nearOld[1]), Number(nearOld[2]), null, "closed by the desk");
        continue;
      }
      if (coin.action === "close" && coin.order && !/rejected/i.test(note)) {
        closeLive(pair, symbol, coin.side || "", decision, null, null, null, "closed by the desk");
        continue;
      }
      if (/expired without a fill|was cancelled|resting limit order is cancelled/i.test(note)) {
        if (open.get(pair)?.status === "working") open.delete(pair);
        continue;
      }

      const filled = note.match(/limit order filled at ([0-9]+(?:\.[0-9]+)?)/i);
      if (filled) {
        const price = Number(filled[1]);
        const live = open.get(pair);
        if (live) {
          live.status = "open";
          live.entry = price;
          live.openedAt = live.openedAt || decision.startedAt;
        } else {
          const created = fromCoin(flow, decision, coin, "open");
          created.entry = price;
          open.set(pair, created);
        }
      } else if ((coin.action === "long" || coin.action === "short") && coin.order && !open.get(pair)) {
        const status = coin.order.type === "limit" ? "working" : "open";
        open.set(pair, fromCoin(flow, decision, coin, status));
      }

      const live = open.get(pair);
      if (!live || live.status !== "open") continue;
      if (coin.stop !== null) live.stop = coin.stop;
      if (coin.target !== null) live.target = coin.target;
      if (coin.pnlPct !== null) live.pnlPct = coin.pnlPct;
      if (coin.r !== null) live.r = coin.r;
      if (coin.setup) live.thesis = coin.setup;
      if (coin.line) live.line = coin.line;
      if (coin.setupType) live.setupType = coin.setupType;
      if (coin.side) live.side = coin.side;
    }
  }

  const newest = [...input.decisions].sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""))[0] ?? null;
  const livePairs = new Set((newest?.coins || []).filter((coin) => coin.inPosition && coin.pair).map((coin) => coin.pair as string));

  if (book) {
    for (const [pair, raw] of Object.entries(book.positions)) {
      if (raw.side !== "long" && raw.side !== "short") continue;
      const live = open.get(pair);
      if (!live || live.status === "working") {
        open.set(pair, {
          id: live?.id ?? `pos:${flow.id}:${pair}:${raw.openedAt || "book"}`,
          symbol: symbolFor(pair, null),
          pair,
          side: raw.side,
          status: "open",
          entry: num(raw.entry),
          stop: num(raw.stop),
          target: num(raw.target),
          volume: num(raw.volume),
          sizePct: live?.sizePct ?? null,
          setupType: raw.setupType || live?.setupType || null,
          thesis: raw.setup || live?.thesis || null,
          line: live?.line ?? null,
          openedAt: iso(num(raw.openedAt)) || live?.openedAt || null,
          openAnalysisId: live?.openAnalysisId ?? null,
          txid: raw.txid || live?.txid || null,
          pnlPct: live?.pnlPct ?? null,
          r: live?.r ?? null,
        });
      } else {
        live.entry = num(raw.entry) ?? live.entry;
        live.stop = num(raw.stop) ?? live.stop;
        live.target = num(raw.target) ?? live.target;
        live.volume = num(raw.volume) ?? live.volume;
        live.openedAt = iso(num(raw.openedAt)) || live.openedAt;
        live.setupType = raw.setupType || live.setupType;
        live.thesis = raw.setup || live.thesis;
        live.txid = raw.txid || live.txid;
        live.side = raw.side;
      }
    }
    for (const [pair, live] of [...open.entries()]) {
      if (live.status !== "open") continue;
      if (book.positions[pair] || livePairs.has(pair)) continue;
      closed.push(emptyDraft(flow, live, null, "closed on the exchange"));
      open.delete(pair);
    }
  }

  const resting: RestingOrder[] = [];
  const pending = book ? book.pending : null;
  if (pending) {
    for (const [pair, raw] of Object.entries(pending)) {
      if (raw.cancelled || (raw.side !== "long" && raw.side !== "short")) continue;
      const live = open.get(pair);
      resting.push({
        flowId: flow.id,
        exchangeId: flow.exchangeId,
        symbol: symbolFor(pair, null),
        pair,
        side: raw.side,
        limit: num(raw.limit),
        stop: num(raw.stop),
        target: num(raw.target),
        volume: num(raw.volume),
        placedAt: iso(num(raw.placedAt)),
        expiresAt: iso(num(raw.expireAt)),
        analysisId: live?.status === "working" ? live.openAnalysisId : null,
        txid: raw.txid || null,
      });
    }
    for (const [pair, live] of [...open.entries()]) {
      if (live.status === "working") open.delete(pair);
    }
  } else {
    for (const [pair, live] of [...open.entries()]) {
      if (live.status !== "working") continue;
      resting.push({
        flowId: flow.id,
        exchangeId: flow.exchangeId,
        symbol: live.symbol,
        pair,
        side: live.side,
        limit: live.entry,
        stop: live.stop,
        target: live.target,
        volume: live.volume,
        placedAt: null,
        expiresAt: null,
        analysisId: live.openAnalysisId,
        txid: live.txid,
      });
      open.delete(pair);
    }
  }

  const latestCoin = new Map<string, CoinLane>();
  if (newest) {
    for (const coin of newest.coins) if (coin.pair) latestCoin.set(coin.pair, coin);
  }

  const positions: PositionView[] = [...open.values()].map((live) => {
    const coin = latestCoin.get(live.pair);
    return {
      tradeId: live.id,
      tradeNo: null,
      flowId: flow.id,
      exchangeId: flow.exchangeId,
      symbol: live.symbol,
      pair: live.pair,
      side: live.side,
      volume: live.volume,
      entry: live.entry,
      stop: live.stop,
      target: live.target,
      pnlPct: coin?.pnlPct ?? live.pnlPct,
      r: coin?.r ?? live.r,
      sizePct: live.sizePct,
      setupType: coin?.setupType || live.setupType,
      thesis: coin?.setup || live.thesis,
      line: coin?.line || live.line,
      openedAt: live.openedAt,
      analysisId: live.openAnalysisId,
    };
  });

  const trades = closed;
  absorb(flow, trades, book?.history ?? []);
  absorb(flow, trades, recorded);
  return { trades, positions, resting };
}

function absorb(flow: TradeFlow, trades: TradeDraft[], rows: StaticHistory[]) {
  const used = new Set<TradeDraft>();
  rows.forEach((row, index) => {
    const symbol = String(row.symbol || "");
    const side = row.side === "long" || row.side === "short" ? row.side : "";
    if (!symbol || !side) return;
    const gross = num(row.grossPct);
    const at = num(row.at);
    const hit = trades.find((trade) => {
      if (used.has(trade) || trade.status !== "closed") return false;
      if (trade.symbol.toUpperCase() !== symbol.toUpperCase() || trade.side !== side) return false;
      if (trade.grossPct !== null && gross !== null && Math.abs(trade.grossPct - gross) < 0.05) return true;
      if (at && trade.closedAt) return Math.abs(Date.parse(trade.closedAt) / 1000 - at) < 6 * 3600;
      const hours = num(row.hours);
      if (!at && trade.grossPct === null && trade.hours !== null && hours !== null && Math.abs(trade.hours - hours) < 1) return true;
      return false;
    });
    if (hit) {
      used.add(hit);
      if (hit.netPct === null) hit.netPct = num(row.netPct);
      if (hit.r === null) hit.r = num(row.r);
      if (hit.hours === null) hit.hours = num(row.hours);
      if (!hit.how && row.how) hit.how = row.how;
      if (!hit.setupType && row.setupType) hit.setupType = row.setupType;
      return;
    }
    const hours = num(row.hours);
    const id = at ? `hist:${flow.id}:${symbol}:${side}:${at}` : `known:${String(index + 1).padStart(2, "0")}:${symbol}:${side}:${gross}`;
    trades.push({
      id,
      flowId: flow.id,
      exchangeId: flow.exchangeId,
      symbol,
      pair: "",
      side,
      status: "closed",
      entry: null,
      exit: null,
      stop: null,
      target: null,
      volume: null,
      sizePct: null,
      grossPct: gross,
      netPct: num(row.netPct),
      r: num(row.r),
      hours,
      setupType: row.setupType || null,
      thesis: null,
      how: row.how || null,
      openedAt: at ? iso(at - (hours || 0) * 3600) : null,
      closedAt: at ? iso(at) : null,
      openAnalysisId: null,
      closeAnalysisId: null,
      txid: null,
    });
  });
}

export function assignTradeNumbers(drafts: TradeDraft[], existing: { id: string; tradeNo: number }[]): Trade[] {
  const kept = new Map(existing.map((row) => [row.id, row.tradeNo]));
  let next = Math.max(0, ...kept.values());
  const sorted = [...drafts].sort((a, b) => {
    const left = a.openedAt ?? "";
    const right = b.openedAt ?? "";
    if (left !== right) return left < right ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return sorted.map((draft) => {
    let tradeNo = kept.get(draft.id);
    if (!tradeNo) {
      next += 1;
      tradeNo = next;
      kept.set(draft.id, tradeNo);
    }
    return { ...draft, tradeNo };
  });
}
