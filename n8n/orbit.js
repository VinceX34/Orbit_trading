import { workflow, node, trigger, ifElse, sticky, newCredential, expr, splitInBatches, nextBatch } from '@n8n/workflow-sdk';

const lanesJson = JSON.stringify([
  { symbol: 'BTC', pair: 'XBTUSDC', alt: 'XBTUSDC', asset: 'XXBT', ordermin: 0.00006, pdec: 2, canShort: true },
  { symbol: 'ETH', pair: 'ETHUSDC', alt: 'ETHUSDC', asset: 'XETH', ordermin: 0.002, pdec: 2, canShort: true },
  { symbol: 'SOL', pair: 'SOLUSDC', alt: 'SOLUSDC', asset: 'SOL', ordermin: 0.05, pdec: 2, canShort: true },
  { symbol: 'XRP', pair: 'XRPUSDC', alt: 'XRPUSDC', asset: 'XXRP', ordermin: 4, pdec: 5, canShort: true },
  { symbol: 'ADA', pair: 'ADAUSDC', alt: 'ADAUSDC', asset: 'ADA', ordermin: 20, pdec: 6, canShort: true },
  { symbol: 'DOGE', pair: 'XDGUSDC', alt: 'XDGUSDC', asset: 'XXDG', ordermin: 50, pdec: 5, canShort: true },
  { symbol: 'LINK', pair: 'LINKUSDC', alt: 'LINKUSDC', asset: 'LINK', ordermin: 0.35, pdec: 5, canShort: true },
  { symbol: 'AVAX', pair: 'AVAXUSDC', alt: 'AVAXUSDC', asset: 'AVAX', ordermin: 0.5, pdec: 3, canShort: false },
  { symbol: 'DOT', pair: 'DOTUSDC', alt: 'DOTUSDC', asset: 'DOT', ordermin: 3.9, pdec: 4, canShort: true },
  { symbol: 'LTC', pair: 'LTCUSDC', alt: 'LTCUSDC', asset: 'XLTC', ordermin: 0.08, pdec: 3, canShort: true },
]);

const pairQuery = 'XBTUSDC,ETHUSDC,SOLUSDC,XRPUSDC,ADAUSDC,XDGUSDC,LINKUSDC,AVAXUSDC,DOTUSDC,LTCUSDC';

const deskValues = {
  lanes: lanesJson,
  pairQuery: pairQuery,
  maxPositions: 2,
  maxSizePct: 45,
  maxStopPct: 1.5,
  minStopPct: 0.3,
  dailyLossPct: -3,
  dailyTargetPct: 1,
  minConfidence: 0.62,
  takerFeePct: 0.4,
  shortLeverage: 2,
  orbitRef: 7071,
};

const instructions = `You are Orbit. Once an hour you read ten Kraken pairs against USDC: BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX, DOT and LTC. You trade both directions. A long is bought on spot. A short is sold on margin at the leverage in the dossier and bought back later. A coin marked long only in the dossier cannot be shorted. No other pairs. No story about a market that is not in the dossier.

The book holds at most two positions at the same time, across all ten coins. Each position may use at most the share of desk equity in the dossier. Pick the best setups: two, one, or none. Most hours the right answer is to wait. Waiting is a decision, and you write it with the same care as a trade.

The method is yours. Read the candles and choose the analysis that fits this hour: trend and market structure, support and resistance, ranges and breakouts, momentum, volume, volatility, moving averages or an RSI you compute yourself from the closes, relative strength between the coins, or anything else the numbers allow. In setup, name the analysis, the numbers it rests on, and why this is a good entry now and not an hour later.

Every new position needs a plan:
stop is the price where the idea is wrong. Kraken places it as a real stop-loss order the moment the trade fills. For a long it sits below the last price, for a short above it, and never further away than the maximum stop distance in the dossier. Losses per coin stay small.
target is the price where you take the profit. The desk closes the position in the first round after the last price touches it. The distance to the target must clearly pay the round-trip toll.
sizePct is the share of desk equity for this position, between 5 and the maximum in the dossier.

Per coin you choose one action:
long opens a long position, only when that coin has no position.
short opens a short position, only when that coin has no position and is not marked long only.
close closes the open position on that coin, long or short.
hold does nothing. On an open position it leaves the stop and target in place.

Count the toll. One leg costs about the taker percentage in the dossier, a round trip twice that. A short also pays a small margin fee every four hours. A move that does not cover that is not an idea.

confidence is a number between 0 and 1. Below the threshold in the dossier no new position opens.

Write in English, in the first person, concrete and calm. Every judgment hangs on a number from the dossier. Forbidden sentences: the market is volatile, this is not financial advice, I see opportunities.

thesis is one sentence for the whole round.
reason is the journal of the round, between 90 and 200 words: what you picked and why, and which coins you deliberately left alone.
mood is one word. No emoji.
coins contains exactly the ten pairs from the dossier, in the same order, with pair exactly as in the dossier. line is one sentence on that coin this hour. setup is your analysis for a new position, or an empty string. stop, target and sizePct are numbers for long and short, and null for close and hold. invalidation is the concrete condition that would make that coin wrong this hour.
Write prices as plain numbers with a dot as decimal sign, as in the dossier.

Reply only in the requested schema.`;

const roundSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    thesis: { type: 'string' },
    reason: { type: 'string' },
    mood: { type: 'string' },
    coins: {
      type: 'array',
      minItems: 10,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pair: { type: 'string' },
          action: { type: 'string', enum: ['long', 'short', 'close', 'hold'] },
          confidence: { type: 'number' },
          line: { type: 'string' },
          setup: { type: 'string' },
          stop: { type: ['number', 'null'] },
          target: { type: ['number', 'null'] },
          sizePct: { type: ['number', 'null'] },
          invalidation: { type: 'string' },
        },
        required: ['pair', 'action', 'confidence', 'line', 'setup', 'stop', 'target', 'sizePct', 'invalidation'],
      },
    },
  },
  required: ['thesis', 'reason', 'mood', 'coins'],
};

const signer = `const crypto = require('crypto');
const store = $getWorkflowStaticData('global');
const nextNonce = Math.max(Date.now() * 1000, Number(store.nonce || 0) + 1);
store.nonce = nextNonce;
const nonce = String(nextNonce);
let secret = '';
try { secret = String($('Kraken Keys').first().json.krakenApiSecret || ''); } catch (error) { secret = ''; }
function sign(path, postData) {
  const hash = crypto.createHash('sha256').update(nonce + postData).digest();
  const apiSign = crypto.createHmac('sha512', Buffer.from(secret, 'base64')).update(Buffer.concat([Buffer.from(path), hash])).digest('base64');
  return { apiSign: apiSign, postData: postData };
}
`;

const scratchCode = `const store = $getWorkflowStaticData('global');
store.scratch = { runId: String($execution.id), candles: {}, fills: [], pending: null };
return $input.all();`;

const fanCode = `const config = $('Desk Config').first().json;
let lanes = [];
try { lanes = JSON.parse(config.lanes); } catch (error) { lanes = []; }
return lanes.map((lane) => ({ json: { symbol: lane.symbol, pair: lane.pair, asset: lane.asset } }));`;

const stashCode = `const body = $input.first().json;
const result = body && body.result && typeof body.result === 'object' ? body.result : {};
const store = $getWorkflowStaticData('global');
if (!store.scratch || typeof store.scratch !== 'object') {
  store.scratch = { runId: String($execution.id), candles: {}, fills: [], pending: null };
}
if (!store.scratch.candles) store.scratch.candles = {};
const names = Object.keys(result);
for (const name of names) {
  if (Array.isArray(result[name])) store.scratch.candles[name] = result[name];
}
return [{ json: { stashed: names[0] || '', rows: names[0] && Array.isArray(result[names[0]]) ? result[names[0]].length : 0 } }];`;

const keysPresentCode = `let key = '';
let secret = '';
try { const row = $('Kraken Keys').first().json; key = String(row.krakenApiKey || '').trim(); secret = String(row.krakenApiSecret || '').trim(); } catch (error) { key = ''; secret = ''; }
return [{ json: { hasKeys: key.length > 0 && secret.length > 0 } }];`;

const signBalanceCode = signer + `const signed = sign('/0/private/Balance', 'nonce=' + nonce);
return [{ json: signed }];`;

const signOpenOrdersCode = signer + `const signed = sign('/0/private/OpenOrders', 'nonce=' + nonce);
return [{ json: signed }];`;

const signTradesCode = signer + `const signed = sign('/0/private/TradesHistory', 'nonce=' + nonce);
return [{ json: signed }];`;

const dossierCode = `function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function clock(date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date);
}
function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function eur(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'unknown';
  return Number(value).toFixed(2);
}
function px(value, digits) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'n/a';
  return Number(value).toFixed(digits);
}
function vol(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'n/a';
  if (amount >= 1000) return String(Math.round(amount));
  if (amount >= 1) return amount.toFixed(1);
  return amount.toFixed(4);
}
function bar(open, high, low, close, volume, digits) {
  return px(open, digits) + '/' + px(high, digits) + '/' + px(low, digits) + '/' + px(close, digits) + '/' + vol(volume);
}
const config = $('Desk Config').first().json;
let laneDefs = [];
try { laneDefs = JSON.parse(config.lanes); } catch (error) { laneDefs = []; }
const tickerBody = $('Ticker').first().json;
const quotes = tickerBody && tickerBody.result ? tickerBody.result : {};
const store = $getWorkflowStaticData('global');
const candles = store.scratch && store.scratch.candles ? store.scratch.candles : {};
if (!store.positions || typeof store.positions !== 'object') store.positions = {};
const positions = store.positions;
const keys = $('Keys Present').first().json;
let balanceBody = null;
let ordersBody = null;
let tradesBody = null;
try { balanceBody = $('Fetch Balance').first().json; } catch (error) { balanceBody = null; }
try { ordersBody = $('Fetch Open Orders').first().json; } catch (error) { ordersBody = null; }
try { tradesBody = $('Fetch Trades').first().json; } catch (error) { tradesBody = null; }
const exchangeErrors = [];
if (tickerBody && Array.isArray(tickerBody.error) && tickerBody.error.length) exchangeErrors.push('Ticker: ' + tickerBody.error.join(', '));
if (!Object.keys(quotes).length) exchangeErrors.push('Ticker returned no prices');
if (balanceBody && Array.isArray(balanceBody.error) && balanceBody.error.length) exchangeErrors.push(balanceBody.error.join(', '));
if (ordersBody && Array.isArray(ordersBody.error) && ordersBody.error.length) exchangeErrors.push(ordersBody.error.join(', '));
if (tradesBody && Array.isArray(tradesBody.error) && tradesBody.error.length) exchangeErrors.push(tradesBody.error.join(', '));
const balances = balanceBody && balanceBody.result ? balanceBody.result : {};
const eurFree = num(balances.USDC) || 0;
const tradeMap = tradesBody && tradesBody.result && tradesBody.result.trades ? tradesBody.result.trades : {};
const openMap = ordersBody && ordersBody.result && ordersBody.result.open ? ordersBody.result.open : {};
const orbitRef = Number(config.orbitRef);
const accountRead = Boolean(keys.hasKeys) && !exchangeErrors.length;
const exits = {};
if (accountRead) {
  for (const pair of Object.keys(positions)) {
    const pos = positions[pair];
    if (!pos || (pos.side !== 'long' && pos.side !== 'short')) { delete positions[pair]; continue; }
    const closeSide = pos.side === 'long' ? 'sell' : 'buy';
    let hit = null;
    for (const id of Object.keys(tradeMap)) {
      const trade = tradeMap[id];
      if (String(trade.pair) !== pair || trade.type !== closeSide) continue;
      if (Number(trade.time) <= Number(pos.openedAt)) continue;
      if (!hit || Number(trade.time) < Number(hit.time)) hit = trade;
    }
    if (!hit) continue;
    const price = num(hit.price) || 0;
    const move = pos.entry ? (pos.side === 'long' ? (price - pos.entry) / pos.entry : (pos.entry - price) / pos.entry) * 100 : 0;
    exits[pair] = 'Since the last round Kraken closed this ' + pos.side + ' at ' + price + ', ' + move.toFixed(2) + '% from the entry at ' + pos.entry + '. Most likely the stop.';
    delete positions[pair];
  }
}
function stopIds(lane, pos) {
  const ids = [];
  const closeSide = pos.side === 'long' ? 'sell' : 'buy';
  for (const id of Object.keys(openMap)) {
    const order = openMap[id] || {};
    const descr = order.descr || {};
    if (String(descr.pair) !== lane.alt) continue;
    if (String(descr.ordertype || '').indexOf('stop') < 0) continue;
    if (descr.type !== closeSide) continue;
    const sameRef = Number(order.userref) === orbitRef;
    const sameSize = pos.volume > 0 && Math.abs(Number(order.vol) - pos.volume) / pos.volume < 0.02;
    if (sameRef || sameSize) ids.push(id);
  }
  return ids;
}
const lanes = [];
const blocks = [];
let positionValue = 0;
for (const lane of laneDefs) {
  const digits = Number(lane.pdec) || 2;
  const quote = quotes[lane.pair] || {};
  const last = num(quote.c && quote.c[0]);
  const bid = num(quote.b && quote.b[0]);
  const ask = num(quote.a && quote.a[0]);
  const open = num(quote.o);
  const low = num(quote.l && quote.l[1]);
  const high = num(quote.h && quote.h[1]);
  const volume24 = num(quote.v && quote.v[1]);
  const rows = Array.isArray(candles[lane.pair]) ? candles[lane.pair] : [];
  const hourly = rows.slice(-24).map((row) => bar(row[1], row[2], row[3], row[4], row[6], digits));
  const days = {};
  const dayOrder = [];
  for (const row of rows) {
    const key = new Date(Number(row[0]) * 1000).toISOString().slice(0, 10);
    if (!days[key]) {
      days[key] = { open: num(row[1]), high: num(row[2]), low: num(row[3]), close: num(row[4]), volume: 0 };
      dayOrder.push(key);
    }
    const day = days[key];
    if (num(row[2]) !== null) day.high = Math.max(day.high, num(row[2]));
    if (num(row[3]) !== null) day.low = Math.min(day.low, num(row[3]));
    day.close = num(row[4]);
    day.volume += num(row[6]) || 0;
  }
  const daily = dayOrder.slice(-14).map((key) => key.slice(5) + ' ' + bar(days[key].open, days[key].high, days[key].low, days[key].close, days[key].volume, digits));
  const pos = positions[lane.pair] || null;
  let position = null;
  if (pos) {
    const mark = pos.side === 'long' ? bid : ask;
    const pnlPct = mark && pos.entry ? (pos.side === 'long' ? (mark - pos.entry) / pos.entry : (pos.entry - mark) / pos.entry) * 100 : null;
    if (mark) positionValue += pos.side === 'long' ? pos.volume * mark : (pos.entry - mark) * pos.volume;
    const ids = stopIds(lane, pos);
    position = {
      side: pos.side, volume: pos.volume, entry: pos.entry, stop: pos.stop, target: pos.target, openedAt: pos.openedAt,
      pnlPct: pnlPct, hours: (Date.now() / 1000 - Number(pos.openedAt)) / 3600, stopIds: ids, stopMissing: Boolean(pos.stopMissing),
    };
  }
  lanes.push({
    symbol: lane.symbol, pair: lane.pair, asset: lane.asset, alt: lane.alt, pdec: digits, ordermin: Number(lane.ordermin) || 0, canShort: lane.canShort !== false,
    last: last, bid: bid, ask: ask, open: open, low: low, high: high, volume24: volume24,
    position: position, holding: Boolean(position), exit: exits[lane.pair] || '',
  });
  const text = [];
  text.push(lane.symbol + ' (pair ' + lane.pair + ')' + (lane.canShort === false ? ', long only' : '') + '. Last ' + px(last, digits) + ', bid ' + px(bid, digits) + ', ask ' + px(ask, digits) + '. 24 hours: open ' + px(open, digits) + ', high ' + px(high, digits) + ', low ' + px(low, digits) + ', volume ' + vol(volume24) + '.');
  text.push('Hourly: ' + (hourly.join(' | ') || 'no candles'));
  text.push('Daily (UTC): ' + (daily.join(' | ') || 'no candles'));
  if (position) {
    text.push('Position: ' + position.side + ' ' + position.volume + ' ' + lane.symbol + ' from ' + px(position.entry, digits) + ', stop ' + px(position.stop, digits) + ', target ' + px(position.target, digits) + ', now ' + (position.pnlPct === null ? 'unknown' : position.pnlPct.toFixed(2) + '%') + ', open ' + position.hours.toFixed(1) + ' hours. ' + (position.stopIds.length ? 'Stop order is live on Kraken.' : 'No stop order found on Kraken.'));
  } else {
    text.push('Position: none.');
  }
  if (exits[lane.pair]) text.push(exits[lane.pair]);
  blocks.push(text.join(String.fromCharCode(10)));
}
const equityEur = accountRead ? eurFree + positionValue : null;
const today = dayKey(new Date());
let dayPnlPct = null;
let dayStart = null;
if (equityEur !== null) {
  if (store.dayKey !== today || typeof store.startEquity !== 'number') {
    store.dayKey = today;
    store.startEquity = equityEur;
  }
  dayStart = store.startEquity;
  if (dayStart > 0) dayPnlPct = ((equityEur - dayStart) / dayStart) * 100;
}
const tradeLines = [];
for (const id of Object.keys(tradeMap)) {
  const trade = tradeMap[id];
  if (dayKey(new Date(Number(trade.time) * 1000)) !== today) continue;
  tradeLines.push(String(trade.pair || '') + ' ' + trade.type + ' ' + trade.vol + ' at ' + trade.price);
}
const openCount = lanes.filter((lane) => lane.holding).length;
const nl = String.fromCharCode(10);
const lines = ['DESK DOSSIER', 'Time in Amsterdam: ' + clock(new Date()), 'Ten Kraken pairs against USDC. Prices and amounts are in USDC. Long on spot, short on margin at ' + config.shortLeverage + 'x. At most ' + config.maxPositions + ' positions at once.', 'Candles are open/high/low/close/volume, old to new. Volume is in the coin. The newest hourly candle is still forming.', ''];
lines.push(blocks.join(nl + nl));
lines.push('');
lines.push('Open positions: ' + openCount + ' of ' + config.maxPositions + '.');
if (equityEur !== null) {
  lines.push('Desk equity: ' + eur(equityEur) + ' USDC, which is free USDC ' + eur(eurFree) + ' plus the open positions. Start of the day: ' + eur(dayStart) + '. Day result: ' + (dayPnlPct === null ? 'unknown' : dayPnlPct.toFixed(3) + '%') + '.');
  lines.push('Maximum per position: ' + config.maxSizePct + '% of desk equity, about ' + eur((equityEur * Number(config.maxSizePct)) / 100) + ' USDC.');
}
lines.push('Stop distance: at most ' + config.maxStopPct + '% and at least ' + config.minStopPct + '% from the last price. Minimum conviction: ' + config.minConfidence + '. Toll per leg: ' + config.takerFeePct + '%. A short also pays roughly 0.02% to open and again every 4 hours.');
lines.push('Day line: +' + config.dailyTargetPct + '%. Above it no new position. Loss limit: ' + config.dailyLossPct + '%. Below it no new position. Closing is always allowed.');
if (!keys.hasKeys) lines.push('The Kraken keys are not in the data table orbit_kraken yet. You may think. You may not trade.');
lines.push(exchangeErrors.length ? 'Kraken said: ' + exchangeErrors.join(' | ') : 'Kraken returned no error.');
lines.push('Trades today: ' + (tradeLines.length ? tradeLines.join(' | ') : 'none.'));
return [{ json: { brief: lines.join(nl), hasKeys: Boolean(keys.hasKeys), exchangeError: exchangeErrors.join(' | '), equityEur: equityEur, dayPnlPct: dayPnlPct, eurFree: eurFree, lanes: lanes } }];`;

const journalCode = `const fence = String.fromCharCode(96).repeat(3);
function parseText(text) {
  let raw = String(text || '').trim();
  if (raw.startsWith(fence)) {
    raw = raw.slice(fence.length).trim();
    if (raw.toLowerCase().startsWith('json')) raw = raw.slice(4).trim();
    if (raw.endsWith(fence)) raw = raw.slice(0, -fence.length).trim();
  }
  if (!raw.startsWith('{') && !raw.startsWith('[')) return null;
  try { return JSON.parse(raw); } catch (error) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)); } catch (inner) { return null; }
    }
  }
  return null;
}
function findRound(value, depth) {
  if (depth > 8 || value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const parsed = parseText(value);
    return parsed ? findRound(parsed, depth + 1) : null;
  }
  if (typeof value !== 'object') return null;
  if (!Array.isArray(value) && Array.isArray(value.coins)) return value;
  const children = Array.isArray(value) ? value : Object.values(value);
  for (const child of children) {
    const found = findRound(child, depth + 1);
    if (found) return found;
  }
  return null;
}
const item = $input.first().json;
const parsed = findRound(item, 0);
const dossier = $('Dossier').first().json;
const calls = parsed && Array.isArray(parsed.coins) ? parsed.coins : [];
return [{ json: {
  hasKeys: dossier.hasKeys,
  exchangeError: dossier.exchangeError,
  equityEur: dossier.equityEur,
  dayPnlPct: dossier.dayPnlPct,
  eurFree: dossier.eurFree,
  lanes: dossier.lanes,
  thesis: parsed && parsed.thesis ? String(parsed.thesis) : '',
  reason: parsed && parsed.reason ? String(parsed.reason) : 'The model answered, but not in the shape Orbit can read. No order this round.',
  mood: parsed && parsed.mood ? String(parsed.mood) : '',
  calls: calls,
  parseError: !parsed || !calls.length,
} }];`;

const gateCode = `function findCall(calls, lane) {
  const symbol = String(lane.symbol || '').toUpperCase();
  const pair = String(lane.pair || '').toUpperCase();
  for (const call of calls) {
    const raw = String(call.pair || '').toUpperCase();
    const key = raw.replace('/USDC', '').replace('USDC', '');
    if (raw === pair || raw === symbol || key === symbol || key === pair) return call;
  }
  return null;
}
function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
const row = $input.first().json;
const config = $('Desk Config').first().json;
const maxPositions = Number(config.maxPositions);
const maxSizePct = Number(config.maxSizePct);
const maxStop = Number(config.maxStopPct);
const minStop = Number(config.minStopPct);
const fee = Number(config.takerFeePct);
const leverage = Number(config.shortLeverage);
const lossLimit = Number(config.dailyLossPct);
const dayTarget = Number(config.dailyTargetPct);
const minConfidence = Number(config.minConfidence);
const lanes = Array.isArray(row.lanes) ? row.lanes : [];
const calls = Array.isArray(row.calls) ? row.calls : [];
const pnl = typeof row.dayPnlPct === 'number' ? row.dayPnlPct : null;
const equity = Number(row.equityEur) || 0;
let bookBlock = null;
if (!row.hasKeys) bookBlock = 'missing_credentials';
else if (row.exchangeError) bookBlock = 'account_unreadable';
else if (row.parseError) bookBlock = 'unreadable';
const loss = pnl !== null && pnl <= lossLimit;
const topped = pnl !== null && pnl >= dayTarget;
const coins = [];
const cancels = [];
const closes = [];
const candidates = [];
for (const lane of lanes) {
  const call = findCall(calls, lane);
  const aiAction = call && ['long', 'short', 'close', 'hold'].indexOf(call.action) >= 0 ? call.action : 'hold';
  const confidence = call ? numberOrNull(call.confidence) || 0 : 0;
  const stop = call ? numberOrNull(call.stop) : null;
  const target = call ? numberOrNull(call.target) : null;
  const sizePct = call ? numberOrNull(call.sizePct) : null;
  const pos = lane.position || null;
  let action = aiAction;
  let blocked = null;
  if (pos && !bookBlock && lane.last && pos.target && ((pos.side === 'long' && lane.last >= pos.target) || (pos.side === 'short' && lane.last <= pos.target))) {
    action = 'close';
    blocked = 'target_hit';
  } else if (pos && !bookBlock && pos.stopMissing) {
    action = 'close';
    blocked = 'stop_missing';
  } else if (bookBlock) { action = 'hold'; blocked = bookBlock; }
  else if (!call) { action = 'hold'; blocked = 'unreadable'; }
  else if (action === 'close' && !pos) { action = 'hold'; blocked = 'already_flat'; }
  else if ((action === 'long' || action === 'short') && pos) { action = 'hold'; blocked = 'already_in_position'; }
  else if (action === 'long' || action === 'short') {
    const ref = lane.last;
    if (action === 'short' && lane.canShort === false) blocked = 'no_short';
    else if (loss) blocked = 'daily_loss';
    else if (topped) blocked = 'target_reached';
    else if (confidence < minConfidence) blocked = 'low_conviction';
    else if (!ref || stop === null || target === null) blocked = 'invalid_setup';
    else {
      const stopDistance = action === 'long' ? ((ref - stop) / ref) * 100 : ((stop - ref) / ref) * 100;
      const gain = action === 'long' ? ((target - ref) / ref) * 100 : ((ref - target) / ref) * 100;
      if (stopDistance <= 0 || gain <= 0) blocked = 'invalid_setup';
      else if (stopDistance > maxStop) blocked = 'stop_too_wide';
      else if (stopDistance < minStop) blocked = 'stop_too_tight';
      else if (gain <= fee * 2 + 0.1) blocked = 'no_edge';
    }
    if (blocked) action = 'hold';
  }
  const coin = {
    symbol: lane.symbol,
    pair: lane.pair,
    action: action,
    aiAction: aiAction,
    confidence: confidence,
    line: call && call.line ? String(call.line) : '',
    setup: call && call.setup ? String(call.setup) : '',
    invalidation: call && call.invalidation ? String(call.invalidation) : '',
    stop: pos ? pos.stop : stop,
    target: pos ? pos.target : target,
    sizePct: pos ? null : sizePct,
    side: pos ? pos.side : action === 'long' || action === 'short' ? action : null,
    entry: pos ? pos.entry : null,
    pnlPct: pos ? pos.pnlPct : null,
    note: lane.exit || '',
    blockedByRule: blocked,
    order: null,
    inPosition: Boolean(pos),
  };
  coins.push(coin);
  if (action === 'close' && pos) {
    for (const txid of pos.stopIds || []) cancels.push({ kind: 'cancel', symbol: lane.symbol, pair: lane.pair, txid: txid });
    closes.push({ kind: 'close', symbol: lane.symbol, pair: lane.pair, side: pos.side, volume: Number(pos.volume).toFixed(8), last: lane.last, leverage: leverage });
  }
  if (action === 'long' || action === 'short') candidates.push({ coin: coin, lane: lane, action: action, confidence: confidence, stop: stop, target: target, sizePct: sizePct });
}
const stillOpen = lanes.filter((lane) => lane.holding).length - closes.length;
let slots = Math.max(0, maxPositions - stillOpen);
let eurLeft = (Number(row.eurFree) || 0) * 0.98;
const opens = [];
candidates.sort((left, right) => right.confidence - left.confidence);
for (const pick of candidates) {
  const coin = pick.coin;
  const lane = pick.lane;
  if (slots <= 0) { coin.action = 'hold'; coin.blockedByRule = 'max_positions'; coin.side = null; continue; }
  const pct = Math.min(maxSizePct, Math.max(5, pick.sizePct === null ? maxSizePct : pick.sizePct));
  let sizeEur = (equity * pct) / 100;
  const perEuro = pick.action === 'long' ? 1 : 1 / leverage;
  if (sizeEur * perEuro > eurLeft) sizeEur = eurLeft / perEuro;
  const price = pick.action === 'long' ? lane.ask : lane.bid;
  if (!price || sizeEur < 5) { coin.action = 'hold'; coin.blockedByRule = 'max_size'; coin.side = null; continue; }
  const volume = sizeEur / price;
  if (volume < lane.ordermin) { coin.action = 'hold'; coin.blockedByRule = 'below_minimum'; coin.side = null; continue; }
  coin.sizePct = Number(((sizeEur / (equity || sizeEur)) * 100).toFixed(1));
  opens.push({
    kind: 'open', symbol: lane.symbol, pair: lane.pair, side: pick.action, volume: volume.toFixed(8),
    stop: Number(pick.stop).toFixed(lane.pdec), target: Number(pick.target), last: lane.last, sizeEur: Number(sizeEur.toFixed(2)),
    leverage: leverage, userref: Number(config.orbitRef),
  });
  eurLeft -= sizeEur * perEuro;
  slots -= 1;
}
const orders = cancels.concat(closes, opens);
return [{ json: {
  pair: 'ten',
  action: opens.length || closes.length ? 'trade' : 'hold',
  aiAction: null,
  reason: row.reason || '',
  thesis: row.thesis || '',
  invalidation: '',
  mood: row.mood || '',
  confidence: null,
  blockedByRule: bookBlock,
  order: null,
  equityQuote: row.equityEur,
  dayPnlPct: pnl,
  inPosition: coins.some((coin) => coin.inPosition),
  coins: coins,
  orders: orders,
  placeAny: orders.length > 0,
  at: new Date().toISOString(),
} }];`;

const fanOrdersCode = `const row = $input.first().json;
const orders = Array.isArray(row.orders) ? row.orders : [];
return orders.map((order) => ({ json: order }));`;

const signOrderCode = signer + `const order = $input.first().json;
if (!store.scratch) store.scratch = { fills: [], pending: null };
store.scratch.pending = order;
let path = '/0/private/AddOrder';
let postData = 'nonce=' + nonce;
if (order.kind === 'cancel') {
  path = '/0/private/CancelOrder';
  postData += '&txid=' + encodeURIComponent(order.txid);
} else if (order.kind === 'close') {
  postData += '&ordertype=market&pair=' + encodeURIComponent(order.pair) + '&volume=' + order.volume;
  if (order.side === 'long') postData += '&type=sell';
  else postData += '&type=buy&leverage=' + order.leverage + '&reduce_only=true';
} else {
  postData += '&ordertype=market&pair=' + encodeURIComponent(order.pair) + '&volume=' + order.volume + '&userref=' + order.userref;
  postData += '&type=' + (order.side === 'long' ? 'buy' : 'sell');
  if (order.side === 'short') postData += '&leverage=' + order.leverage;
  postData += '&close%5Bordertype%5D=stop-loss&close%5Bprice%5D=' + order.stop;
}
const signed = sign(path, postData);
return [{ json: { apiSign: signed.apiSign, postData: signed.postData, path: path } }];`;

const recordCode = `const response = $input.first().json;
const store = $getWorkflowStaticData('global');
const pending = store.scratch && store.scratch.pending ? store.scratch.pending : {};
if (!Array.isArray(store.scratch.fills)) store.scratch.fills = [];
const errors = Array.isArray(response.error) ? response.error.filter(Boolean) : [];
const message = response.error && !Array.isArray(response.error) ? String(response.error.message || response.error) : '';
const txid = response.result && Array.isArray(response.result.txid) ? response.result.txid[0] : null;
const descr = response.result && response.result.descr ? response.result.descr.order : null;
const rejected = pending.kind === 'cancel' ? errors.length > 0 || Boolean(message) : errors.length > 0 || Boolean(message) || !txid;
store.scratch.fills.push({
  kind: pending.kind, pair: pending.pair, side: pending.side, rejected: rejected, txid: txid, descr: descr,
  note: errors.join(', ') || message || '', volume: pending.volume, last: pending.last, stop: pending.stop, target: pending.target, sizeEur: pending.sizeEur,
});
return [{ json: { pair: pending.pair, kind: pending.kind, rejected: rejected } }];`;

const assembleCode = `const gate = $('Risk Gate').first().json;
const store = $getWorkflowStaticData('global');
if (!store.positions || typeof store.positions !== 'object') store.positions = {};
const positions = store.positions;
const fills = store.scratch && Array.isArray(store.scratch.fills) ? store.scratch.fills : [];
const now = Math.floor(Date.now() / 1000);
const coins = (Array.isArray(gate.coins) ? gate.coins : []).map((coin) => {
  const mine = fills.filter((fill) => fill.pair === coin.pair);
  if (!mine.length) return coin;
  const next = Object.assign({}, coin);
  const notes = coin.note ? [coin.note] : [];
  const cancelled = mine.some((fill) => fill.kind === 'cancel' && !fill.rejected);
  const cancelFailed = mine.some((fill) => fill.kind === 'cancel' && fill.rejected);
  const close = mine.find((fill) => fill.kind === 'close');
  const open = mine.find((fill) => fill.kind === 'open');
  if (close) {
    const pos = positions[coin.pair];
    if (close.rejected) {
      if (pos && cancelled) pos.stopMissing = true;
      next.action = 'hold';
      next.blockedByRule = 'exchange_rejected';
      notes.push('Kraken rejected the close' + (close.note ? ': ' + close.note : '.') + (cancelled ? ' The stop is gone, so the desk retries next round.' : ''));
    } else {
      if (pos && pos.entry && close.last) {
        const move = pos.side === 'long' ? (close.last - pos.entry) / pos.entry : (pos.entry - close.last) / pos.entry;
        notes.push('Closed near ' + close.last + ', ' + (move * 100).toFixed(2) + '% from the entry before fees.');
      }
      if (cancelFailed) notes.push('Kraken did not cancel the old stop order. Check open orders on Kraken.');
      delete positions[coin.pair];
      next.inPosition = false;
      next.order = { type: 'market', side: close.side === 'long' ? 'sell' : 'buy', volume: String(close.volume), txid: close.txid, descr: close.descr };
    }
  }
  if (open) {
    if (open.rejected) {
      next.action = 'hold';
      next.side = null;
      next.blockedByRule = 'exchange_rejected';
      notes.push('Kraken rejected the order' + (open.note ? ': ' + open.note : '.'));
    } else {
      positions[coin.pair] = {
        side: open.side, volume: Number(open.volume), entry: Number(open.last), stop: Number(open.stop), target: Number(open.target),
        openedAt: now - 30, sizeEur: open.sizeEur, txid: open.txid,
      };
      next.inPosition = true;
      next.entry = Number(open.last);
      next.order = { type: 'market', side: open.side === 'long' ? 'buy' : 'sell', volume: String(open.volume), txid: open.txid, descr: open.descr };
    }
  }
  next.note = notes.join(' ');
  return next;
});
return [{ json: {
  pair: gate.pair, action: gate.action, aiAction: gate.aiAction, reason: gate.reason, thesis: gate.thesis,
  invalidation: gate.invalidation, mood: gate.mood, confidence: gate.confidence, blockedByRule: gate.blockedByRule,
  order: null, equityQuote: gate.equityQuote, dayPnlPct: gate.dayPnlPct, inPosition: coins.some((coin) => coin.inPosition),
  coins: coins, at: new Date().toISOString(),
} }];`;

const offlineCode = `let dossier = {};
try { dossier = $('Dossier').first().json; } catch (error) { dossier = {}; }
let lanes = Array.isArray(dossier.lanes) ? dossier.lanes : [];
if (!lanes.length) {
  try { lanes = JSON.parse($('Desk Config').first().json.lanes); } catch (error) { lanes = []; }
}
const coins = lanes.map((lane) => ({
  symbol: lane.symbol, pair: lane.pair, action: 'hold', aiAction: 'hold', confidence: 0,
  line: 'The lamp is on. The model is not.', invalidation: 'This line drops once the model returns a journal.',
  side: lane.position ? lane.position.side : null, stop: lane.position ? lane.position.stop : null, target: lane.position ? lane.position.target : null,
  note: lane.exit || '', blockedByRule: 'model_offline', order: null, inPosition: Boolean(lane.holding),
}));
return [{ json: {
  pair: 'ten', action: 'hold', aiAction: 'hold',
  reason: 'The ring on the desk is lit, but OpenAI did not answer. Until it does, Orbit opens nothing. Stops already on Kraken stay in place.',
  thesis: 'No model, no new order.', invalidation: '', mood: 'waiting', confidence: null,
  blockedByRule: 'model_offline', order: null,
  equityQuote: dossier.equityEur === undefined ? null : dossier.equityEur,
  dayPnlPct: dossier.dayPnlPct === undefined ? null : dossier.dayPnlPct,
  inPosition: coins.some((coin) => coin.inPosition), coins: coins, orders: [], placeAny: false, at: new Date().toISOString(),
} }];`;

const keysNoteText = 'Kraken key and secret live in the data table orbit_kraken. No withdraw permission. Shorts run on Kraken margin with the same key, so margin must be enabled on the account. Without the row Orbit reads prices and writes wait.';
const gateNoteText = 'Orbit picks and plans every trade. The Risk Gate checks it: at most two positions, each at most 45% of desk equity, a stop within 1.5%, a target that pays the fees, conviction above 0.62, and the day limits. Every opening carries a real stop-loss on Kraken. The numbers live on Desk Config.';
const publishNoteText = 'Published means every hour, two minutes past. Manual watch is for a test. The app only switches publish on and off.';

const hourly = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.4, config: { name: 'Hourly Watch', parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 2 }] } }, output: [{ scheduled: true }] } });
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Manual watch', output: [{ manual: true }] } });
const desk = node({ type: 'n8n-nodes-base.set', version: 3.5, config: { name: 'Desk Config', executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: Object.entries(deskValues).map(([name, value]) => ({ id: name, name: name, value: value, type: typeof value === 'number' ? 'number' : 'string' })) } }, output: [{ pairQuery: pairQuery }] } });
const krakenKeys = node({ type: 'n8n-nodes-base.dataTable', version: 1.1, config: { name: 'Kraken Keys', executeOnce: true, parameters: { resource: 'row', operation: 'get', returnAll: true, dataTableId: { __rl: true, mode: 'id', value: 'RUTyxzyDwwWH97no', cachedResultName: 'orbit_kraken' } }, output: [{ krakenApiKey: '', krakenApiSecret: '' }] } });
const ticker = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Ticker', executeOnce: true, parameters: { method: 'GET', url: expr('{{ "https://api.kraken.com/0/public/Ticker?pair=" + $(\'Desk Config\').first().json.pairQuery }}'), authentication: 'none', options: { response: { response: { responseFormat: 'json' } } } }, output: [{ error: [], result: {} }] } });
const scratch = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Open Scratch', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: scratchCode }, output: [{ ok: true }] } });
const fan = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Fan Lanes', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: fanCode }, output: [{ symbol: 'BTC', pair: 'XBTUSDC', asset: 'XXBT' }] } });
const pause = node({ type: 'n8n-nodes-base.wait', version: 1.1, config: { name: 'Pause', parameters: { resume: 'timeInterval', amount: 1, unit: 'seconds' }, output: [{ symbol: 'BTC', pair: 'XBTUSDC' }] } });
const candle = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Hourly candle', parameters: { method: 'GET', url: expr('{{ "https://api.kraken.com/0/public/OHLC?pair=" + $json.pair + "&interval=60" }}'), authentication: 'none', options: { response: { response: { responseFormat: 'json' } } } }, output: [{ error: [], result: { XBTUSDC: [[1700000000, '1', '1', '1', '1', '1', '1', 1]] } }] } });
const stash = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Stash candle', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: stashCode }, output: [{ stashed: 'XBTUSDC', rows: 1 }] } });
const candleLoop = splitInBatches({ version: 3, config: { name: 'Candle Lanes', parameters: { batchSize: 1 } } });
const keysPresent = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Keys Present', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: keysPresentCode }, output: [{ hasKeys: false }] } });
const keysReady = ifElse({ version: 2.4, config: { name: 'Keys Ready?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ leftValue: expr('{{ $json.hasKeys }}'), rightValue: true, operator: { type: 'boolean', operation: 'true' } }], combinator: 'and' } }, output: [{ hasKeys: true }] } });
const privateHeaders = { parameters: [{ name: 'API-Key', value: expr("{{ $('Kraken Keys').first().json.krakenApiKey }}") }, { name: 'API-Sign', value: expr('{{ $json.apiSign }}') }] };
const privateHttp = { authentication: 'none', sendHeaders: true, specifyHeaders: 'keypair', headerParameters: privateHeaders, sendBody: true, contentType: 'raw', rawContentType: 'application/x-www-form-urlencoded', body: expr('{{ $json.postData }}'), options: { lowercaseHeaders: false, response: { response: { responseFormat: 'json' } } } };
const signBalance = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Sign Balance', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: signBalanceCode }, output: [{ apiSign: 'sign', postData: 'nonce=1' }] } });
const fetchBalance = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Fetch Balance', executeOnce: true, parameters: { method: 'POST', url: 'https://api.kraken.com/0/private/Balance', ...privateHttp }, output: [{ error: [], result: { USDC: '100' } }] } });
const signOrders = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Sign Open Orders', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: signOpenOrdersCode }, output: [{ apiSign: 'sign', postData: 'nonce=2' }] } });
const fetchOrders = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Fetch Open Orders', executeOnce: true, parameters: { method: 'POST', url: 'https://api.kraken.com/0/private/OpenOrders', ...privateHttp }, output: [{ error: [], result: { open: {} } }] } });
const signTrades = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Sign Trades', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: signTradesCode }, output: [{ apiSign: 'sign', postData: 'nonce=3' }] } });
const fetchTrades = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Fetch Trades', executeOnce: true, parameters: { method: 'POST', url: 'https://api.kraken.com/0/private/TradesHistory', ...privateHttp }, output: [{ error: [], result: { trades: {} } }] } });
const dossier = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Dossier', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: dossierCode }, output: [{ brief: 'DOSSIER', hasKeys: false, lanes: [] }] } });
const orbit = node({ type: '@n8n/n8n-nodes-langchain.openAi', version: 2.3, config: { name: 'Orbit', executeOnce: true, onError: 'continueErrorOutput', credentials: { openAiApi: newCredential('OpenAi account') }, parameters: { resource: 'text', operation: 'response', modelId: { __rl: true, mode: 'list', value: 'gpt-5.6-luna', cachedResultName: 'GPT-5.6-LUNA' }, simplify: true, responses: { values: [{ type: 'text', role: 'system', content: instructions }, { type: 'text', role: 'user', content: expr('{{ $json.brief }}') }] }, options: { maxTokens: 12000, store: false, reasoning: { reasoningOptions: { effort: 'medium', summary: 'concise' } }, textFormat: { textOptions: { type: 'json_schema', name: 'orbit_round', description: 'The journal of this round and the decision for each coin.', strict: true, schema: roundSchema } } } }, output: [{ output: '{"thesis":"I am waiting."}' }] } });
const offline = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Model Offline', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: offlineCode }, output: [{ action: 'hold', blockedByRule: 'model_offline' }] } });
const journal = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Read Journal', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: journalCode }, output: [{ parseError: false, calls: [] }] } });
const gate = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Risk Gate', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: gateCode }, output: [{ action: 'hold', placeAny: false, coins: [] }] } });
const place = ifElse({ version: 2.4, config: { name: 'Place Orders?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ leftValue: expr('{{ $json.placeAny }}'), rightValue: true, operator: { type: 'boolean', operation: 'true' } }], combinator: 'and' } }, output: [{ placeAny: false }] } });
const fanOrders = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Fan Orders', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: fanOrdersCode }, output: [{ kind: 'open', pair: 'XBTUSDC', side: 'long', volume: '0.001' }] } });
const orderLoop = splitInBatches({ version: 3, config: { name: 'Order Lanes', parameters: { batchSize: 1 } } });
const signOrder = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Sign Order', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: signOrderCode }, output: [{ apiSign: 'sign', postData: 'nonce=4', path: '/0/private/AddOrder' }] } });
const sendOrder = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Send Order', onError: 'continueRegularOutput', parameters: { method: 'POST', url: expr('{{ "https://api.kraken.com" + $json.path }}'), ...privateHttp }, output: [{ error: [], result: { txid: ['ORDER-ID'] } }] } });
const record = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Record Fill', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: recordCode }, output: [{ pair: 'XBTUSDC', kind: 'open', rejected: false }] } });
const assemble = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Assemble', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: assembleCode }, output: [{ action: 'hold', coins: [] }] } });
const decision = node({ type: 'n8n-nodes-base.set', version: 3.5, config: { name: 'Decision', executeOnce: true, parameters: { mode: 'raw', jsonOutput: expr('{{ JSON.stringify($json) }}') }, output: [{ action: 'hold', reason: 'I am waiting.' }] } });
const keysNote = sticky(keysNoteText, [keysPresent], { color: 5 });
const gateNote = sticky(gateNoteText, [gate], { color: 6 });
const publishNote = sticky(publishNoteText, [hourly], { color: 4 });

export default workflow('orbit-ten-lanes', 'Orbit')
  .add(hourly)
  .to(desk)
  .to(krakenKeys)
  .to(ticker)
  .to(scratch)
  .to(fan)
  .to(candleLoop.onEachBatch(pause.to(candle).to(stash).to(nextBatch(candleLoop))).onDone(keysPresent.to(keysReady.onTrue(signBalance.to(fetchBalance).to(signOrders).to(fetchOrders).to(signTrades).to(fetchTrades).to(dossier)).onFalse(dossier))))
  .add(manual)
  .to(desk)
  .add(dossier)
  .to(orbit.onError(offline.to(decision)))
  .add(orbit)
  .to(journal)
  .to(gate)
  .to(place.onTrue(fanOrders.to(orderLoop.onEachBatch(signOrder.to(sendOrder).to(record).to(nextBatch(orderLoop))).onDone(assemble.to(decision)))).onFalse(decision))
  .add(keysNote)
  .add(gateNote)
  .add(publishNote)
  .group('Market', [desk, ticker, scratch, fan], { description: 'The ten pairs, the ticker, and the empty scratch pad for this round.' })
  .group('Account', [signBalance, fetchBalance, signOrders, fetchOrders, signTrades, fetchTrades], { description: 'Balance, open orders and trades. Only when the keys are present.' })
  .group('Order', [signOrder, sendOrder, record], { description: 'Cancels, closes, then openings. Every opening carries a stop-loss on Kraken.' });
