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
  riskPerTradePct: 2,
  minStopAtr: 1.2,
  maxStopAtr: 3.5,
  maxStopPct: 6,
  minNetRR: 1.3,
  minConfidence: 0.62,
  takerFeePct: 0.8,
  makerFeePct: 0.4,
  shortLeverage: 2,
  orbitRef: 7071,
  entryTtlMin: 55,
  breakEvenR: 1,
  trailStartR: 1.5,
  trailAtr: 2,
  timeStopHours: 72,
  cooldownHours: 6,
};

const instructions = `You are Orbit, a swing trader on ten Kraken pairs against USDC: BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX, DOT and LTC. You trade both directions. A long is bought on spot. A short is sold on margin at the leverage in the dossier. A coin marked long only cannot be shorted. The goal is to grow the desk after fees. There is no daily limit in either direction. The only thing that counts is the quality of each trade.

Fees decide everything here. The dossier gives the fee per leg on this account. A full trade costs more than one percent of the position before the price has moved. A small move is never a trade. You hold for hours to days, not minutes. Most rounds you open nothing, and that is correct.

Every round has two phases, in this order.

PHASE ONE: THE BOOK
Go through every open position and every resting order before you look at anything new. The dossier gives each position a card: result in percent and in R (one R is the distance from entry to the first stop), the best and worst it has been, hours open, the trend score at entry and now, your own thesis and invalidation from the entry, and a desk reading with flags. Judge each position on these questions:
1. Is the thesis still true, or has your own invalidation happened?
2. Is the trend score still on your side on the 4h and the daily, or has it faded or flipped?
3. Did the last closed hourly candles break the structure you leaned on, a swing low for a long or a swing high for a short?
4. Is momentum fading against you: RSI rolling over, closes against the position, volume rising on the wrong side?
5. Is the position paying for the time it takes, or is it stale?
6. Is the remaining distance to the target still realistic against the nearest swing and the range?
Then choose:
hold, when the thesis is intact. Do not close a healthy position because of one candle. Noise inside the stop is the cost of the trade.
manage, to tighten the stop behind new structure or to move the target. A stop only ever moves in the direction of the profit. Give the new stop, the new target, or both; null leaves a level as it is.
close, when the thesis is broken. Do not wait for the stop to say what you already see. When the desk reading says BROKEN, close unless you can name the number that proves it wrong.
For a resting limit order that has not filled: hold leaves it, close cancels it.
The desk also manages by rule, with or without you: at plus one R the stop goes to the entry, from plus one and a half R it trails behind the best price, a touched target is closed, and a position that goes nowhere for days is closed.

PHASE TWO: THE HUNT
Only then look for new trades, and only if a slot is free. The book holds at most two positions, resting orders included. Two positions in the same direction are one bet on the market, so prefer the strongest coin for a long and the weakest for a short. A long in the strongest coin with a short in the weakest earns on the difference and hedges the market.

The dossier computes the numbers for you: trend score from minus 100 to plus 100 across daily, 4h and 1h, ADX, EMAs, ATR, RSI on three timeframes, Bollinger position and squeeze, ranges, volume against its average, VWAP, swing highs and lows, relative strength against BTC and a strength rank. Use them. Do not recompute them and do not invent numbers that are not there.

The house playbook. Name the one you use in setupType.
trend_pullback: trend score beyond 50 in your direction, ADX 4h above 20. Price has pulled back toward the EMA20 on 1h or 4h or a prior swing, RSI 1h has cooled to the middle, and the last closed candle turns back with the trend. The entry is a limit at the pullback level. The stop sits beyond the pullback swing. The target is the prior extreme or beyond.
breakout: Bollinger width in its lowest fifth, then an hourly close beyond the 24h or 72h range on volume above one and a half times average, not against the 4h trend. The entry is a limit at the retest of the broken level. The stop sits back inside the range.
range_fade: ADX 4h below 18 and a flat trend score. Price at the edge of the 72h range with RSI 1h beyond 70 or below 30 and a rejection wick. The target is the middle or the other edge. The stop sits beyond the edge.
exhaustion_reversal: a move of more than three ATR in a few hours into an RSI extreme on 1h and 4h, a volume climax, then a candle that reclaims. Rare, small, and only with a stop beyond the extreme.
other: your own idea, when the numbers support it. Say exactly which numbers.
Never sell a coin that is already deeply oversold after a fall, and never buy one that is already overbought after a run, unless it is one of the setups above. Chasing the last candle is how this desk lost money. Read the list of your last trades in the dossier and do not repeat a pattern that failed.

Every new trade needs:
entry: the limit price where you want to be filled. The desk places a resting limit order there, never above the bid for a long and never below the ask for a short, valid for about one hour. If the price does not come to you, there is no trade, and that is fine.
stop: the price where the idea is wrong, beyond real structure. The distance from the entry must fall inside the stop band given per coin in the dossier, which is set by the 4h ATR. A stop inside the noise is a donation.
target: the price where you take the profit. The reward after fees must be at least the multiple of the risk after fees given in the dossier.
sizePct: the share of desk equity, up to the maximum in the dossier. The desk makes it smaller when the stop is wide, so that one stop never costs more than the risk per trade in the dossier.
confidence: between 0 and 1. Below the threshold in the dossier nothing opens.

Per coin you choose one action: long, short, close, manage or hold.

Write in English, in the first person, concrete and calm. Every judgment hangs on a number from the dossier. Forbidden sentences: the market is volatile, this is not financial advice, I see opportunities.

thesis is one sentence for the whole round.
reason is the journal of the round, between 100 and 220 words: first the verdict on each open position and resting order, then what you looked for and why you opened or did not.
mood is one word. No emoji.
coins contains exactly the ten pairs from the dossier, in the same order, with pair exactly as in the dossier. line is one sentence on that coin this hour. setup is your analysis: for a new trade the setup and why this entry, for an open position your answers to the review questions, otherwise an empty string. setupType is none for close, manage and hold. entry, stop, target and sizePct are numbers for long and short. For manage, stop and target are the new levels or null, and entry and sizePct are null. For close and hold all four are null. invalidation is the concrete condition that would make your view on that coin wrong.
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
          action: { type: 'string', enum: ['long', 'short', 'close', 'manage', 'hold'] },
          setupType: { type: 'string', enum: ['trend_pullback', 'breakout', 'range_fade', 'exhaustion_reversal', 'other', 'none'] },
          confidence: { type: 'number' },
          line: { type: 'string' },
          setup: { type: 'string' },
          entry: { type: ['number', 'null'] },
          stop: { type: ['number', 'null'] },
          target: { type: ['number', 'null'] },
          sizePct: { type: ['number', 'null'] },
          invalidation: { type: 'string' },
        },
        required: ['pair', 'action', 'setupType', 'confidence', 'line', 'setup', 'entry', 'stop', 'target', 'sizePct', 'invalidation'],
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
function ok(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}
function clock(date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date);
}
function dayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function eur(value) {
  return ok(value) ? Number(value).toFixed(2) : 'unknown';
}
function px(value, digits) {
  return ok(value) ? Number(value).toFixed(digits) : 'n/a';
}
function sg(value, digits) {
  if (!ok(value)) return 'n/a';
  const amount = Number(value);
  return (amount > 0 ? '+' : '') + amount.toFixed(digits);
}
function fx(value, digits) {
  return ok(value) ? Number(value).toFixed(digits) : 'n/a';
}
function vol(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'n/a';
  if (amount >= 1000) return String(Math.round(amount));
  if (amount >= 1) return amount.toFixed(1);
  return amount.toFixed(4);
}
function lastOf(list) {
  return list.length ? list[list.length - 1] : null;
}
function emaSeries(values, n) {
  const k = 2 / (n + 1);
  const out = [];
  let prev = null;
  for (const value of values) {
    prev = prev === null ? value : value * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
function rsi(closes, n) {
  if (closes.length <= n) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}
function atr(bars, n) {
  if (bars.length <= n) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const p = bars[i - 1].c;
    trs.push(Math.max(b.h - b.l, Math.abs(b.h - p), Math.abs(b.l - p)));
  }
  let value = 0;
  for (let i = 0; i < n; i++) value += trs[i];
  value /= n;
  for (let i = n; i < trs.length; i++) value = (value * (n - 1) + trs[i]) / n;
  return value;
}
function adx(bars, n) {
  if (bars.length <= n * 2) return null;
  let trS = 0;
  let pS = 0;
  let mS = 0;
  const dxs = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const p = bars[i - 1];
    const up = b.h - p.h;
    const down = p.l - b.l;
    const pdm = up > down && up > 0 ? up : 0;
    const mdm = down > up && down > 0 ? down : 0;
    const tr = Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
    if (i <= n) {
      trS += tr; pS += pdm; mS += mdm;
      if (i < n) continue;
    } else {
      trS = trS - trS / n + tr;
      pS = pS - pS / n + pdm;
      mS = mS - mS / n + mdm;
    }
    const pdi = trS ? (100 * pS) / trS : 0;
    const mdi = trS ? (100 * mS) / trS : 0;
    dxs.push(pdi + mdi ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0);
  }
  if (dxs.length < n) return null;
  let value = 0;
  for (let i = 0; i < n; i++) value += dxs[i];
  value /= n;
  for (let i = n; i < dxs.length; i++) value = (value * (n - 1) + dxs[i]) / n;
  return value;
}
function group(bars, seconds) {
  const out = [];
  let key = null;
  for (const b of bars) {
    const k = Math.floor(b.t / seconds);
    if (k !== key) {
      out.push({ t: k * seconds, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
      key = k;
    } else {
      const g = out[out.length - 1];
      g.h = Math.max(g.h, b.h);
      g.l = Math.min(g.l, b.l);
      g.c = b.c;
      g.v += b.v;
    }
  }
  return out;
}
function pivots(bars, w) {
  const highs = [];
  const lows = [];
  for (let i = w; i < bars.length - w; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (bars[j].h >= bars[i].h) isHigh = false;
      if (bars[j].l <= bars[i].l) isLow = false;
    }
    if (isHigh) highs.push(bars[i].h);
    if (isLow) lows.push(bars[i].l);
  }
  return { highs: highs.slice(-3), lows: lows.slice(-3) };
}
function maxOf(bars, key) {
  let value = null;
  for (const b of bars) if (value === null || b[key] > value) value = b[key];
  return value;
}
function minOf(bars, key) {
  let value = null;
  for (const b of bars) if (value === null || b[key] < value) value = b[key];
  return value;
}
function sumOf(bars, key) {
  let value = 0;
  for (const b of bars) value += b[key] || 0;
  return value;
}
function barText(b, digits) {
  return px(b.o, digits) + '/' + px(b.h, digits) + '/' + px(b.l, digits) + '/' + px(b.c, digits) + '/' + vol(b.v);
}
const nl = String.fromCharCode(10);
const config = $('Desk Config').first().json;
let laneDefs = [];
try { laneDefs = JSON.parse(config.lanes); } catch (error) { laneDefs = []; }
const tickerBody = $('Ticker').first().json;
const quotes = tickerBody && tickerBody.result ? tickerBody.result : {};
const store = $getWorkflowStaticData('global');
const candles = store.scratch && store.scratch.candles ? store.scratch.candles : {};
if (!store.positions || typeof store.positions !== 'object') store.positions = {};
if (!store.pending || typeof store.pending !== 'object') store.pending = {};
if (!store.cooldown || typeof store.cooldown !== 'object') store.cooldown = {};
if (!Array.isArray(store.history)) {
  store.history = [
    { symbol: 'BTC', side: 'short', setupType: 'before the rebuild', grossPct: 4.36, netPct: 2.75, r: null, hours: 11.0, how: 'closed by the desk', at: 0 },
    { symbol: 'ETH', side: 'short', setupType: 'before the rebuild', grossPct: 1.83, netPct: 0.22, r: null, hours: 4.0, how: 'closed by the desk', at: 0 },
    { symbol: 'BTC', side: 'long', setupType: 'before the rebuild', grossPct: -0.52, netPct: -2.12, r: null, hours: 3.5, how: 'stop on Kraken', at: 0 },
    { symbol: 'SOL', side: 'long', setupType: 'before the rebuild', grossPct: -0.62, netPct: -2.22, r: null, hours: 3.6, how: 'stop on Kraken', at: 0 },
    { symbol: 'ETH', side: 'short', setupType: 'before the rebuild', grossPct: -1.5, netPct: -3.12, r: null, hours: 3.3, how: 'stop on Kraken', at: 0 },
    { symbol: 'XRP', side: 'short', setupType: 'before the rebuild', grossPct: -1.22, netPct: -2.84, r: null, hours: 2.5, how: 'stop on Kraken', at: 0 },
    { symbol: 'BTC', side: 'short', setupType: 'before the rebuild', grossPct: -1.26, netPct: -2.87, r: null, hours: 0.8, how: 'stop on Kraken', at: 0 },
    { symbol: 'ETH', side: 'short', setupType: 'before the rebuild', grossPct: -1.68, netPct: -3.29, r: null, hours: 0.8, how: 'stop on Kraken', at: 0 },
  ];
}
const positions = store.positions;
const pendings = store.pending;
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
if (keys.hasKeys && (!balanceBody || !balanceBody.result || !ordersBody || !ordersBody.result || !tradesBody || !tradesBody.result)) exchangeErrors.push('Kraken did not return the account');
const balances = balanceBody && balanceBody.result ? balanceBody.result : {};
const eurFree = num(balances.USDC) || 0;
const tradeMap = tradesBody && tradesBody.result && tradesBody.result.trades ? tradesBody.result.trades : {};
const tradeList = Object.keys(tradeMap).map((id) => tradeMap[id]);
const openMap = ordersBody && ordersBody.result && ordersBody.result.open ? ordersBody.result.open : {};
const orbitRef = Number(config.orbitRef);
const accountRead = Boolean(keys.hasKeys) && !exchangeErrors.length;
const nowSec = Date.now() / 1000;
const symbolOf = {};
for (const lane of laneDefs) symbolOf[lane.pair] = lane.symbol;
let taker = Number(config.takerFeePct) || 0.8;
let maker = Number(config.makerFeePct) || 0.4;
let takerAt = 0;
let makerAt = 0;
for (const trade of tradeList) {
  const time = Number(trade.time);
  const cost = Number(trade.cost);
  const fee = Number(trade.fee);
  if (!symbolOf[String(trade.pair)] || !(cost > 0) || !(fee > 0) || nowSec - time > 30 * 86400) continue;
  const rate = (fee / cost) * 100;
  if (trade.maker === true) {
    if (time > makerAt) { maker = rate; makerAt = time; }
  } else if (time > takerAt) { taker = rate; takerAt = time; }
}
if (takerAt && !makerAt) maker = taker / 2;
const feeRT = maker + taker;
function fillsOf(txid) {
  let volume = 0;
  let cost = 0;
  let fee = 0;
  let first = null;
  for (const trade of tradeList) {
    if (!txid || String(trade.ordertxid) !== String(txid)) continue;
    volume += Number(trade.vol) || 0;
    cost += Number(trade.cost) || 0;
    fee += Number(trade.fee) || 0;
    const time = Number(trade.time);
    if (first === null || time < first) first = time;
  }
  return volume > 0 ? { volume: volume, price: cost / volume, cost: cost, fee: fee, time: first } : null;
}
const notes = {};
function addNote(pair, text) {
  notes[pair] = notes[pair] ? notes[pair] + ' ' + text : text;
}
function remember(entry) {
  store.history.push(entry);
  if (store.history.length > 40) store.history = store.history.slice(-40);
}
if (accountRead) {
  for (const pair of Object.keys(pendings)) {
    const pend = pendings[pair];
    if (!pend || !pend.txid) { delete pendings[pair]; continue; }
    const fill = fillsOf(pend.txid);
    const working = Boolean(openMap[pend.txid]);
    if (fill && !positions[pair]) {
      positions[pair] = {
        side: pend.side, volume: fill.volume, entry: fill.price, stop: pend.stop, initStop: pend.stop, target: pend.target,
        openedAt: fill.time, txid: pend.txid, feeIn: fill.fee, costIn: fill.cost, best: fill.price,
        setup: pend.setup || '', setupType: pend.setupType || 'other', invalidation: pend.invalidation || '', trendAtEntry: pend.trend,
      };
      addNote(pair, 'The limit order filled at ' + fill.price + '.');
    }
    if (!working) {
      if (!fill) addNote(pair, 'The limit order at ' + pend.limit + (pend.cancelled ? ' was cancelled.' : ' expired without a fill. No trade.'));
      delete pendings[pair];
    }
  }
  for (const pair of Object.keys(positions)) {
    const pos = positions[pair];
    if (!pos || (pos.side !== 'long' && pos.side !== 'short')) { delete positions[pair]; continue; }
    const fill = fillsOf(pos.txid);
    if (fill) {
      pos.volume = fill.volume;
      pos.entry = fill.price;
      pos.feeIn = fill.fee;
      pos.costIn = fill.cost;
      pos.openedAt = fill.time;
    }
    if (!ok(pos.initStop)) pos.initStop = pos.stop;
    const closeSide = pos.side === 'long' ? 'sell' : 'buy';
    let volume = 0;
    let cost = 0;
    let fee = 0;
    let lastTime = 0;
    for (const trade of tradeList) {
      if (String(trade.pair) !== pair || trade.type !== closeSide) continue;
      if (Number(trade.time) <= Number(pos.openedAt)) continue;
      if (String(trade.ordertxid) === String(pos.txid)) continue;
      volume += Number(trade.vol) || 0;
      cost += Number(trade.cost) || 0;
      fee += Number(trade.fee) || 0;
      if (Number(trade.time) > lastTime) lastTime = Number(trade.time);
    }
    if (!(volume >= pos.volume * 0.5)) continue;
    const price = cost / volume;
    const dir = pos.side === 'long' ? 1 : -1;
    const gross = ((dir * (price - pos.entry)) / pos.entry) * 100;
    const feePct = pos.costIn > 0 ? (((Number(pos.feeIn) || 0) + fee) / pos.costIn) * 100 : feeRT;
    const net = gross - feePct;
    const risk = Math.abs(pos.entry - pos.initStop);
    remember({
      symbol: symbolOf[pair] || pair, side: pos.side, setupType: pos.setupType || 'other', grossPct: gross, netPct: net,
      r: risk > 0 ? (dir * (price - pos.entry)) / risk : null, hours: (lastTime - Number(pos.openedAt)) / 3600, how: 'stop on Kraken', at: lastTime,
    });
    addNote(pair, 'Since the last round Kraken closed this ' + pos.side + ' at ' + price + ': ' + sg(gross, 2) + '% on the price, ' + sg(net, 2) + '% after fees. Most likely the stop.');
    if (net < 0) store.cooldown[pair] = { side: pos.side, until: lastTime + Number(config.cooldownHours) * 3600 };
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
const cards = [];
let positionValue = 0;
for (const lane of laneDefs) {
  const digits = Number(lane.pdec) || 2;
  const quote = quotes[lane.pair] || {};
  const last = num(quote.c && quote.c[0]);
  const bid = num(quote.b && quote.b[0]);
  const ask = num(quote.a && quote.a[0]);
  const rows = Array.isArray(candles[lane.pair]) ? candles[lane.pair] : [];
  const all = rows.map((row) => ({ t: Number(row[0]), o: num(row[1]), h: num(row[2]), l: num(row[3]), c: num(row[4]), vw: num(row[5]), v: num(row[6]) || 0 })).filter((b) => b.o !== null && b.h !== null && b.l !== null && b.c !== null);
  const h1 = all.slice(0, -1);
  const price = last || (all.length ? all[all.length - 1].c : null);
  const h4 = group(h1, 14400);
  const d1 = group(h1, 86400);
  const c1 = h1.map((b) => b.c);
  const c4 = h4.map((b) => b.c);
  const cd = d1.map((b) => b.c);
  const ema20 = c1.length >= 50 ? lastOf(emaSeries(c1, 20)) : null;
  const ema50 = c1.length >= 100 ? lastOf(emaSeries(c1, 50)) : null;
  const ema20h4 = c4.length >= 40 ? lastOf(emaSeries(c4, 20)) : null;
  const ema50h4 = c4.length >= 80 ? lastOf(emaSeries(c4, 50)) : null;
  const ema10d = cd.length >= 15 ? lastOf(emaSeries(cd, 10)) : null;
  const atr1 = atr(h1.slice(-200), 14);
  const atr4 = atr(h4, 14);
  const rsi1 = rsi(c1.slice(-200), 14);
  const rsi4 = rsi(c4, 14);
  const rsiD = rsi(cd, 14);
  const adx1 = adx(h1.slice(-200), 14);
  const adx4 = adx(h4, 14);
  const sw1 = pivots(h1.slice(-120), 3);
  const sw4 = pivots(h4.slice(-90), 2);
  let trend = 0;
  if (price && ema10d) trend += price > ema10d ? 20 : -20;
  if (ema20h4 && ema50h4) trend += ema20h4 > ema50h4 ? 25 : -25;
  if (price && ema20h4) trend += price > ema20h4 ? 15 : -15;
  if (ema20 && ema50) trend += ema20 > ema50 ? 15 : -15;
  if (price && ema20) trend += price > ema20 ? 10 : -10;
  let structure = 'mixed';
  if (sw1.highs.length >= 2 && sw1.lows.length >= 2) {
    const hh = sw1.highs[sw1.highs.length - 1] > sw1.highs[sw1.highs.length - 2];
    const hl = sw1.lows[sw1.lows.length - 1] > sw1.lows[sw1.lows.length - 2];
    if (hh && hl) { structure = 'higher highs and higher lows'; trend += 15; }
    else if (!hh && !hl) { structure = 'lower highs and lower lows'; trend -= 15; }
  }
  let regime = 'mixed';
  if (trend >= 50 && adx4 !== null && adx4 >= 18) regime = 'uptrend';
  else if (trend <= -50 && adx4 !== null && adx4 >= 18) regime = 'downtrend';
  else if (Math.abs(trend) < 50 && adx4 !== null && adx4 < 18) regime = 'range';
  let pctB = null;
  let bbWidth = null;
  let bbRank = null;
  if (c1.length >= 140 && price) {
    const widths = [];
    for (let k = 0; k < 120; k++) {
      const window = c1.slice(c1.length - k - 20, c1.length - k);
      let mean = 0;
      for (const value of window) mean += value;
      mean /= window.length;
      let variance = 0;
      for (const value of window) variance += (value - mean) * (value - mean);
      const sd = Math.sqrt(variance / window.length);
      widths.push(mean ? ((4 * sd) / mean) * 100 : 0);
      if (k === 0 && sd > 0) pctB = (price - (mean - 2 * sd)) / (4 * sd);
    }
    bbWidth = widths[0];
    let narrower = 0;
    for (const width of widths) if (width < bbWidth) narrower += 1;
    bbRank = (narrower / widths.length) * 100;
  }
  const hi24 = maxOf(h1.slice(-24), 'h');
  const lo24 = minOf(h1.slice(-24), 'l');
  const hi72 = maxOf(h1.slice(-72), 'h');
  const lo72 = minOf(h1.slice(-72), 'l');
  const hi30 = maxOf(h1, 'h');
  const lo30 = minOf(h1, 'l');
  const rangePos = price && hi72 !== null && lo72 !== null && hi72 > lo72 ? ((price - lo72) / (hi72 - lo72)) * 100 : null;
  const lastBar = h1.length ? h1[h1.length - 1] : null;
  const avg20 = h1.length > 21 ? sumOf(h1.slice(-21, -1), 'v') / 20 : null;
  const volRatio = lastBar && avg20 ? lastBar.v / avg20 : null;
  const vol24 = sumOf(h1.slice(-24), 'v');
  const volWeek = h1.length >= 168 ? sumOf(h1.slice(-168), 'v') / 7 : null;
  const dayRatio = volWeek ? vol24 / volWeek : null;
  let vwNum = 0;
  let vwDen = 0;
  for (const b of h1.slice(-24)) { vwNum += (b.vw || b.c) * b.v; vwDen += b.v; }
  const vwap = vwDen > 0 ? vwNum / vwDen : null;
  function ret(n) {
    return price && c1.length >= n && c1[c1.length - n] ? (price / c1[c1.length - n] - 1) * 100 : null;
  }
  const card = {
    lane: lane, digits: digits, last: last, bid: bid, ask: ask, price: price, h1: h1, h4: h4, d1: d1,
    ema20: ema20, ema50: ema50, ema20h4: ema20h4, ema50h4: ema50h4, ema10d: ema10d, atr1: atr1, atr4: atr4,
    rsi1: rsi1, rsi4: rsi4, rsiD: rsiD, adx1: adx1, adx4: adx4, sw1: sw1, sw4: sw4, trend: trend, structure: structure, regime: regime,
    pctB: pctB, bbWidth: bbWidth, bbRank: bbRank, hi24: hi24, lo24: lo24, hi72: hi72, lo72: lo72, hi30: hi30, lo30: lo30, rangePos: rangePos,
    volRatio: volRatio, dayRatio: dayRatio, vwap: vwap, r1: ret(1), r4: ret(4), r24: ret(24), r72: ret(72), r168: ret(168),
    position: null, pending: null, review: '',
  };
  const pos = positions[lane.pair] || null;
  if (pos) {
    const dir = pos.side === 'long' ? 1 : -1;
    const mark = pos.side === 'long' ? bid : ask;
    let best = ok(pos.best) ? Number(pos.best) : pos.entry;
    let worst = pos.entry;
    for (const b of all) {
      if (b.t < Number(pos.openedAt)) continue;
      best = dir > 0 ? Math.max(best, b.h) : Math.min(best, b.l);
      worst = dir > 0 ? Math.min(worst, b.l) : Math.max(worst, b.h);
    }
    if (mark) best = dir > 0 ? Math.max(best, mark) : Math.min(best, mark);
    pos.best = best;
    const risk = Math.abs(pos.entry - pos.initStop) || pos.entry * 0.01;
    const rNow = mark ? (dir * (mark - pos.entry)) / risk : null;
    const mfeR = (dir * (best - pos.entry)) / risk;
    const maeR = (dir * (worst - pos.entry)) / risk;
    const pnlPct = mark ? ((dir * (mark - pos.entry)) / pos.entry) * 100 : null;
    const hours = (nowSec - Number(pos.openedAt)) / 3600;
    if (mark) positionValue += pos.side === 'long' ? pos.volume * mark : (pos.entry - mark) * pos.volume;
    const flags = [];
    let points = 0;
    const trendNow = dir * trend;
    const trendDrop = ok(pos.trendAtEntry) ? dir * Number(pos.trendAtEntry) - trendNow : null;
    if (trendNow <= -30 && (trendDrop === null || trendDrop >= 30)) { flags.push('the trend score has turned against the position'); points += 2; }
    else if (trendDrop !== null ? trendDrop >= 30 : trendNow < 20) { flags.push('the trend score is weaker than at the entry'); points += 1; }
    const swing = dir > 0 ? lastOf(sw1.lows) : lastOf(sw1.highs);
    if (lastBar && swing !== null && dir * (lastBar.c - swing) < 0) { flags.push('the last hourly close broke the last swing ' + (dir > 0 ? 'low' : 'high') + ' at ' + px(swing, digits)); points += 2; }
    if (mfeR >= 1 && rNow !== null && rNow < mfeR * 0.4) { flags.push('more than half of the best gain is given back'); points += 1; }
    if (hours >= 24 && rNow !== null && rNow < 0.3) { flags.push('stale after ' + hours.toFixed(0) + ' hours'); points += 1; }
    const three = h1.slice(-3);
    if (three.length === 3 && three.every((b) => dir * (b.c - b.o) < 0)) { flags.push('three closed hourly candles in a row against it'); points += 1; }
    if (rsi4 !== null && ((dir > 0 && rsi4 > 75) || (dir < 0 && rsi4 < 25))) flags.push('RSI 4h is stretched in your favour, consider a tighter stop');
    const verdict = points >= 3 ? 'BROKEN' : points >= 1 ? 'WEAKENING' : 'HEALTHY';
    const ids = stopIds(lane, pos);
    card.position = {
      side: pos.side, volume: pos.volume, entry: pos.entry, stop: pos.stop, initStop: pos.initStop, target: pos.target, openedAt: pos.openedAt,
      pnlPct: pnlPct, rNow: rNow, mfeR: mfeR, best: best, hours: hours, stopIds: ids, stopMissing: Boolean(pos.stopMissing), verdict: verdict, setupType: pos.setupType || 'other',
    };
    const lines = [];
    lines.push('POSITION: ' + pos.side + ' ' + pos.volume + ' ' + lane.symbol + ' from ' + px(pos.entry, digits) + ', open ' + hours.toFixed(1) + ' hours. Now ' + sg(pnlPct, 2) + '% on the price, ' + sg(rNow, 2) + 'R. Best ' + sg(mfeR, 2) + 'R, worst ' + sg(maeR, 2) + 'R.');
    lines.push('Stop ' + px(pos.stop, digits) + (pos.stop !== pos.initStop ? ' (first stop ' + px(pos.initStop, digits) + ')' : '') + (mark && atr1 ? ', ' + fx(Math.abs(mark - pos.stop) / atr1, 1) + ' ATR 1h from the price' : '') + '. Target ' + px(pos.target, digits) + (mark && atr1 && ok(pos.target) ? ', ' + fx(Math.abs(pos.target - mark) / atr1, 1) + ' ATR 1h away' : '') + '. ' + (ids.length ? 'The stop order is live on Kraken.' : 'No stop order found on Kraken, the desk places one this round.'));
    lines.push('Trend score at entry ' + (ok(pos.trendAtEntry) ? sg(pos.trendAtEntry, 0) : 'unknown') + ', now ' + sg(trend, 0) + '. Setup: ' + (pos.setupType || 'other') + '.');
    if (pos.setup) lines.push('Your thesis at entry: ' + pos.setup);
    if (pos.invalidation) lines.push('Your invalidation at entry: ' + pos.invalidation);
    lines.push('Desk reading: ' + verdict + (flags.length ? ' (' + flags.join('; ') + ').' : '. No flags.'));
    card.review = lines.join(nl);
  }
  const pend = pendings[lane.pair] || null;
  if (pend) {
    card.pending = { txid: pend.txid, side: pend.side, limit: pend.limit, volume: pend.volume, stop: pend.stop, target: pend.target, expireAt: pend.expireAt, cancelled: Boolean(pend.cancelled) };
    if (!pos) card.review = 'RESTING ORDER: ' + pend.side + ' limit at ' + px(pend.limit, digits) + ' for ' + pend.volume + ' ' + lane.symbol + ', stop ' + px(pend.stop, digits) + ', target ' + px(pend.target, digits) + '. Not filled yet. It expires in about ' + Math.max(0, Math.round((Number(pend.expireAt) - nowSec) / 60)) + ' minutes. Setup: ' + (pend.setup || pend.setupType || '') ;
  }
  cards.push(card);
}
const btc = cards.find((card) => card.lane.symbol === 'BTC') || null;
const ranked = cards.filter((card) => card.r72 !== null && card.r168 !== null).slice().sort((a, b) => (b.r72 + b.r168) - (a.r72 + a.r168));
const blocks = [];
const lanes = [];
for (const card of cards) {
  const lane = card.lane;
  const d = card.digits;
  const rank = ranked.indexOf(card);
  const atr1Pct = card.atr1 && card.price ? (card.atr1 / card.price) * 100 : null;
  const atr4Pct = card.atr4 && card.price ? (card.atr4 / card.price) * 100 : null;
  const minStop = atr4Pct !== null ? Number(config.minStopAtr) * atr4Pct : null;
  const maxStop = atr4Pct !== null ? Math.min(Number(config.maxStopAtr) * atr4Pct, Number(config.maxStopPct)) : null;
  const cool = store.cooldown[lane.pair] && Number(store.cooldown[lane.pair].until) > nowSec ? store.cooldown[lane.pair] : null;
  const text = [];
  text.push(lane.symbol + ' (pair ' + lane.pair + ')' + (lane.canShort === false ? ', long only' : '') + '. Last ' + px(card.last, d) + ', bid ' + px(card.bid, d) + ', ask ' + px(card.ask, d) + '.');
  text.push('Trend score ' + sg(card.trend, 0) + ' (' + card.regime + '). 1h structure: ' + card.structure + '. ADX 4h ' + fx(card.adx4, 0) + ', 1h ' + fx(card.adx1, 0) + '. Strength rank ' + (rank >= 0 ? rank + 1 : 'n/a') + ' of ' + cards.length + '.');
  text.push('EMA 1h 20/50: ' + px(card.ema20, d) + ' / ' + px(card.ema50, d) + '. EMA 4h 20/50: ' + px(card.ema20h4, d) + ' / ' + px(card.ema50h4, d) + '. Daily EMA10: ' + px(card.ema10d, d) + '. Stretch: ' + (card.price && card.ema20 && card.atr1 ? sg((card.price - card.ema20) / card.atr1, 1) : 'n/a') + ' ATR from EMA20 1h, ' + (card.price && card.ema20h4 && card.atr4 ? sg((card.price - card.ema20h4) / card.atr4, 1) : 'n/a') + ' ATR from EMA20 4h.');
  text.push('ATR 1h ' + fx(atr1Pct, 2) + '% (' + px(card.atr1, d) + '), ATR 4h ' + fx(atr4Pct, 2) + '% (' + px(card.atr4, d) + '). Stop band for a new trade: ' + fx(minStop, 2) + '% to ' + fx(maxStop, 2) + '% from the entry. With the tightest stop the target must be at least ' + (minStop !== null ? fx(Number(config.minNetRR) * (minStop + feeRT) + feeRT, 2) : 'n/a') + '% away.');
  text.push('RSI 1h ' + fx(card.rsi1, 0) + ', 4h ' + fx(card.rsi4, 0) + ', daily ' + fx(card.rsiD, 0) + '. Bollinger 1h: %B ' + fx(card.pctB, 2) + ', width ' + fx(card.bbWidth, 2) + '%, wider than ' + fx(card.bbRank, 0) + '% of the last 5 days.');
  text.push('Returns: 1h ' + sg(card.r1, 2) + '%, 4h ' + sg(card.r4, 2) + '%, 24h ' + sg(card.r24, 2) + '%, 72h ' + sg(card.r72, 2) + '%, 7d ' + sg(card.r168, 2) + '%.' + (btc && card !== btc && card.r24 !== null && btc.r24 !== null && card.r168 !== null && btc.r168 !== null ? ' Against BTC: 24h ' + sg(card.r24 - btc.r24, 2) + '%, 7d ' + sg(card.r168 - btc.r168, 2) + '%.' : ''));
  text.push('Range 24h ' + px(card.lo24, d) + ' to ' + px(card.hi24, d) + ', 72h ' + px(card.lo72, d) + ' to ' + px(card.hi72, d) + ', 30d ' + px(card.lo30, d) + ' to ' + px(card.hi30, d) + '. Price sits at ' + fx(card.rangePos, 0) + '% of the 72h range. VWAP 24h ' + px(card.vwap, d) + (card.vwap && card.price ? ', price ' + sg((card.price / card.vwap - 1) * 100, 2) + '% from it' : '') + '.');
  text.push('Volume: last closed hour ' + fx(card.volRatio, 1) + 'x its 20h average, last 24h ' + fx(card.dayRatio, 1) + 'x the 7d daily average.');
  text.push('Swings 1h, highs ' + (card.sw1.highs.map((v) => px(v, d)).join(', ') || 'none') + '; lows ' + (card.sw1.lows.map((v) => px(v, d)).join(', ') || 'none') + '. Swings 4h, highs ' + (card.sw4.highs.map((v) => px(v, d)).join(', ') || 'none') + '; lows ' + (card.sw4.lows.map((v) => px(v, d)).join(', ') || 'none') + '.');
  text.push('1h closed: ' + (card.h1.slice(-12).map((b) => barText(b, d)).join(' | ') || 'no candles'));
  text.push('4h: ' + (card.h4.slice(-8).map((b) => barText(b, d)).join(' | ') || 'no candles'));
  text.push('Daily: ' + (card.d1.slice(-10).map((b) => new Date(b.t * 1000).toISOString().slice(5, 10) + ' ' + barText(b, d)).join(' | ') || 'no candles'));
  text.push(card.review || 'No position.');
  if (cool) text.push('Cooldown: the last ' + cool.side + ' here was a loss. No new ' + cool.side + ' on this coin for ' + ((Number(cool.until) - nowSec) / 3600).toFixed(1) + ' more hours.');
  if (notes[lane.pair]) text.push(notes[lane.pair]);
  blocks.push(text.join(nl));
  lanes.push({
    symbol: lane.symbol, pair: lane.pair, asset: lane.asset, alt: lane.alt, pdec: d, ordermin: Number(lane.ordermin) || 0, canShort: lane.canShort !== false,
    last: card.last, bid: card.bid, ask: card.ask, atr1h: card.atr1, atr4h: card.atr4, ema20h4: card.ema20h4, trend: card.trend,
    position: card.position, pending: card.pending, holding: Boolean(card.position), note: notes[lane.pair] || '', cooldown: cool,
  });
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
const up = cards.filter((card) => card.trend >= 30).length;
const down = cards.filter((card) => card.trend <= -30).length;
let avg24 = 0;
let avgCount = 0;
for (const card of cards) if (card.r24 !== null) { avg24 += card.r24; avgCount += 1; }
const openCount = lanes.filter((lane) => lane.position).length;
const restingCount = lanes.filter((lane) => lane.pending && !lane.position).length;
const lines = ['DESK DOSSIER', 'Time in Amsterdam: ' + clock(new Date()) + '.', 'Ten Kraken pairs against USDC. Prices and amounts are in USDC. Long on spot, short on margin at ' + config.shortLeverage + 'x.', 'Candles are open/high/low/close/volume, old to new, closed candles only. Volume is in the coin. The 4h and daily candles are built from the hourly ones, so the newest of each is still forming. Indicators use closed hourly candles, the last price is live.', ''];
lines.push('MARKET');
lines.push('BTC trend score ' + (btc ? sg(btc.trend, 0) : 'n/a') + '. ' + up + ' of ' + cards.length + ' coins trend above +30, ' + down + ' below -30. Average 24h move ' + (avgCount ? sg(avg24 / avgCount, 2) : 'n/a') + '%.');
if (ranked.length >= 6) lines.push('Strongest over 3 to 7 days: ' + ranked.slice(0, 3).map((card) => card.lane.symbol).join(', ') + '. Weakest: ' + ranked.slice(-3).reverse().map((card) => card.lane.symbol).join(', ') + '.');
lines.push('');
lines.push('THE BOOK');
lines.push('Open positions: ' + openCount + '. Resting orders: ' + restingCount + '. The book holds at most ' + config.maxPositions + ' together.');
if (equityEur !== null) {
  lines.push('Desk equity: ' + eur(equityEur) + ' USDC, which is free USDC ' + eur(eurFree) + ' plus the open positions. Today: ' + (dayPnlPct === null ? 'unknown' : sg(dayPnlPct, 2) + '%') + '. There is no daily limit.');
  lines.push('Maximum per position: ' + config.maxSizePct + '% of desk equity, about ' + eur((equityEur * Number(config.maxSizePct)) / 100) + ' USDC. Risk per trade: a stop may cost at most ' + config.riskPerTradePct + '% of desk equity, fees included.');
}
lines.push('Fees on this account now: ' + fx(maker, 2) + '% for a resting limit order, ' + fx(taker, 2) + '% for a market order or a stop. A trade that enters on a limit and leaves at market costs about ' + fx(feeRT, 2) + '% of the position.');
lines.push('Reward rule: (target distance - ' + fx(feeRT, 2) + '%) must be at least ' + config.minNetRR + ' times (stop distance + ' + fx(feeRT, 2) + '%). Minimum conviction: ' + config.minConfidence + '.');
lines.push('');
lines.push('YOUR LAST TRADES, old to new');
const recent = store.history.slice(-10);
if (recent.length) {
  for (const trade of recent) {
    lines.push(trade.symbol + ' ' + trade.side + ' (' + (trade.setupType || 'other') + '): ' + sg(trade.grossPct, 2) + '% on the price, ' + sg(trade.netPct, 2) + '% after fees' + (ok(trade.r) ? ', ' + sg(trade.r, 1) + 'R' : '') + ', ' + trade.how + ' after ' + fx(trade.hours, 1) + ' hours.');
  }
  const wins = recent.filter((trade) => Number(trade.netPct) > 0).length;
  let sum = 0;
  for (const trade of recent) sum += Number(trade.netPct) || 0;
  lines.push(wins + ' of ' + recent.length + ' ended in profit after fees. Sum ' + sg(sum, 2) + '% of position size.');
} else {
  lines.push('None yet.');
}
lines.push('');
lines.push('THE TEN COINS');
lines.push(blocks.join(nl + nl));
lines.push('');
if (!keys.hasKeys) lines.push('The Kraken keys are not in the data table orbit_kraken yet. You may think. You may not trade.');
lines.push(exchangeErrors.length ? 'Kraken said: ' + exchangeErrors.join(' | ') : 'Kraken returned no error.');
return [{ json: { brief: lines.join(nl), hasKeys: Boolean(keys.hasKeys), exchangeError: exchangeErrors.join(' | '), equityEur: equityEur, dayPnlPct: dayPnlPct, eurFree: eurFree, fees: { maker: maker, taker: taker }, lanes: lanes } }];`;

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
  fees: dossier.fees,
  lanes: dossier.lanes,
  thesis: parsed && parsed.thesis ? String(parsed.thesis) : '',
  reason: parsed && parsed.reason ? String(parsed.reason) : 'The model answered, but not in the shape Orbit can read. Nothing new opens this round. The desk rules on open positions still ran.',
  mood: parsed && parsed.mood ? String(parsed.mood) : '',
  calls: calls,
  parseError: !parsed || !calls.length,
  offline: false,
} }];`;

const offlineCode = `let dossier = {};
try { dossier = $('Dossier').first().json; } catch (error) { dossier = {}; }
return [{ json: {
  hasKeys: Boolean(dossier.hasKeys),
  exchangeError: dossier.exchangeError || '',
  equityEur: dossier.equityEur === undefined ? null : dossier.equityEur,
  dayPnlPct: dossier.dayPnlPct === undefined ? null : dossier.dayPnlPct,
  eurFree: dossier.eurFree || 0,
  fees: dossier.fees || null,
  lanes: Array.isArray(dossier.lanes) ? dossier.lanes : [],
  thesis: 'No model, no new order.',
  reason: 'The ring on the desk is lit, but OpenAI did not answer. Nothing new opens. The desk rules on open positions still ran, and the stops on Kraken stay in place.',
  mood: 'waiting',
  calls: [],
  parseError: true,
  offline: true,
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
function floorTo(value, digits) {
  const f = Math.pow(10, digits);
  return Math.floor(value * f + 1e-9) / f;
}
function ceilTo(value, digits) {
  const f = Math.pow(10, digits);
  return Math.ceil(value * f - 1e-9) / f;
}
const row = $input.first().json;
const config = $('Desk Config').first().json;
const store = $getWorkflowStaticData('global');
if (!store.positions || typeof store.positions !== 'object') store.positions = {};
const nowSec = Math.floor(Date.now() / 1000);
const fees = row.fees && Number(row.fees.taker) > 0 ? row.fees : { maker: Number(config.makerFeePct), taker: Number(config.takerFeePct) };
const feeRT = Number(fees.maker) + Number(fees.taker);
const maxPositions = Number(config.maxPositions);
const maxSizePct = Number(config.maxSizePct);
const riskPct = Number(config.riskPerTradePct);
const minStopAtr = Number(config.minStopAtr);
const maxStopAtr = Number(config.maxStopAtr);
const maxStopPct = Number(config.maxStopPct);
const minNetRR = Number(config.minNetRR);
const minConfidence = Number(config.minConfidence);
const leverage = Number(config.shortLeverage);
const beR = Number(config.breakEvenR);
const trailR = Number(config.trailStartR);
const trailAtr = Number(config.trailAtr);
const timeStopHours = Number(config.timeStopHours);
const userref = Number(config.orbitRef);
const lanes = Array.isArray(row.lanes) ? row.lanes : [];
const calls = Array.isArray(row.calls) ? row.calls : [];
const pnl = typeof row.dayPnlPct === 'number' ? row.dayPnlPct : null;
const equity = Number(row.equityEur) || 0;
const hardBlock = !row.hasKeys ? 'missing_credentials' : row.exchangeError ? 'account_unreadable' : null;
const softBlock = row.offline ? 'model_offline' : row.parseError ? 'unreadable' : null;
const actions = ['long', 'short', 'close', 'manage', 'hold'];
const coins = [];
const cancels = [];
const closes = [];
const amends = [];
const candidates = [];
let slotsUsed = 0;
let reserved = 0;
for (const lane of lanes) {
  const call = softBlock ? null : findCall(calls, lane);
  const aiAction = call && actions.indexOf(call.action) >= 0 ? call.action : 'hold';
  const confidence = call ? numberOrNull(call.confidence) || 0 : 0;
  const entryCall = call ? numberOrNull(call.entry) : null;
  const stopCall = call ? numberOrNull(call.stop) : null;
  const targetCall = call ? numberOrNull(call.target) : null;
  const sizeCall = call ? numberOrNull(call.sizePct) : null;
  const pos = lane.position || null;
  const pend = lane.pending || null;
  const digits = Number(lane.pdec) || 2;
  const atr1 = Number(lane.atr1h) || 0;
  const atr4 = Number(lane.atr4h) || 0;
  const notes = lane.note ? [lane.note] : [];
  let action = 'hold';
  let blocked = null;
  let side = null;
  let showEntry = null;
  let showStop = null;
  let showTarget = null;
  let showSize = null;
  let candidate = null;
  if (pos) {
    side = pos.side;
    showEntry = pos.entry;
    showStop = pos.stop;
    showTarget = pos.target;
  } else if (pend) {
    side = pend.side;
    showEntry = pend.limit;
    showStop = pend.stop;
    showTarget = pend.target;
  }
  if (hardBlock) {
    blocked = hardBlock;
  } else if (pos) {
    const dir = pos.side === 'long' ? 1 : -1;
    const mkt = pos.side === 'long' ? lane.bid : lane.ask;
    let closeWhy = null;
    if (mkt) {
      if (pos.stopMissing) closeWhy = 'stop_missing';
      else if (lane.last && pos.target && dir * (lane.last - pos.target) >= 0) closeWhy = 'target_hit';
      else if (aiAction === 'close') closeWhy = 'model_close';
      else if (pos.hours >= timeStopHours && pos.rNow !== null && pos.rNow < 0.5) closeWhy = 'time_stop';
      let want = pos.stop;
      let why = '';
      if (!closeWhy) {
        if (pos.mfeR >= beR && dir * (pos.entry - want) > 0) { want = pos.entry; why = 'break-even after +' + beR + 'R'; }
        if (pos.mfeR >= trailR && atr4 > 0) {
          const trail = pos.best - dir * trailAtr * atr4;
          if (dir * (trail - want) > 0) { want = trail; why = 'trailing ' + trailAtr + ' ATR 4h behind the best price'; }
        }
        if (why && dir * (mkt - want) <= atr1 * 0.1) closeWhy = 'trail_exit';
      }
      if (!closeWhy) {
        if (aiAction === 'manage' && stopCall !== null && dir * (stopCall - want) > 0) {
          if (dir * (mkt - stopCall) > atr1 * 0.5) { want = stopCall; why = 'your call'; }
          else blocked = 'stop_too_close';
        }
        want = pos.side === 'long' ? floorTo(want, digits) : ceilTo(want, digits);
        const ids = Array.isArray(pos.stopIds) ? pos.stopIds : [];
        if (!ids.length) {
          if (dir * (mkt - want) > 0) amends.push({ kind: 'stop', symbol: lane.symbol, pair: lane.pair, side: pos.side, volume: Number(pos.volume).toFixed(8), stop: want.toFixed(digits), leverage: leverage, userref: userref, why: why || 'the stop order was missing' });
          else closeWhy = 'stop_missing';
        } else if (dir * (want - pos.stop) > atr1 * 0.1) {
          for (const txid of ids) amends.push({ kind: 'amend', symbol: lane.symbol, pair: lane.pair, txid: txid, stop: want.toFixed(digits), why: why });
        }
      }
      if (!closeWhy) {
        if (aiAction === 'manage' && targetCall !== null) {
          if (dir * (targetCall - mkt) > atr1 * 0.5) {
            if (store.positions[lane.pair]) store.positions[lane.pair].target = targetCall;
            showTarget = targetCall;
            notes.push('Target moved to ' + targetCall + '.');
          } else if (!blocked) blocked = 'invalid_setup';
        }
        action = aiAction === 'manage' ? 'manage' : 'hold';
        if (aiAction === 'long' || aiAction === 'short') blocked = 'already_in_position';
        if (!blocked && softBlock) blocked = softBlock;
      }
    } else if (softBlock) blocked = softBlock;
    if (closeWhy) {
      action = 'close';
      blocked = closeWhy === 'model_close' ? null : closeWhy;
      for (const txid of pos.stopIds || []) cancels.push({ kind: 'cancel', symbol: lane.symbol, pair: lane.pair, txid: txid });
      closes.push({ kind: 'close', symbol: lane.symbol, pair: lane.pair, side: pos.side, volume: Number(pos.volume).toFixed(8), last: lane.last, leverage: leverage, why: closeWhy });
    } else {
      slotsUsed += 1;
      if (pos.side === 'short') reserved += (pos.volume * pos.entry) / leverage;
    }
    if (pend) cancels.push({ kind: 'cancel', symbol: lane.symbol, pair: lane.pair, txid: pend.txid, pending: true });
  } else if (pend) {
    if (aiAction === 'close') {
      action = 'close';
      cancels.push({ kind: 'cancel', symbol: lane.symbol, pair: lane.pair, txid: pend.txid, pending: true });
    } else {
      if (aiAction === 'long' || aiAction === 'short') blocked = 'order_pending';
      else if (softBlock) blocked = softBlock;
      if (!pend.cancelled) {
        slotsUsed += 1;
        reserved += pend.side === 'long' ? pend.volume * pend.limit : (pend.volume * pend.limit) / leverage;
      }
    }
  } else if (softBlock) {
    blocked = softBlock;
  } else if (!call) {
    blocked = 'unreadable';
  } else if (aiAction === 'close' || aiAction === 'manage') {
    blocked = 'already_flat';
  } else if (aiAction === 'long' || aiAction === 'short') {
    const dir = aiAction === 'long' ? 1 : -1;
    const mkt = aiAction === 'long' ? lane.bid : lane.ask;
    side = aiAction;
    showStop = stopCall;
    showTarget = targetCall;
    showSize = sizeCall;
    showEntry = entryCall;
    if (aiAction === 'short' && lane.canShort === false) blocked = 'no_short';
    else if (lane.cooldown && lane.cooldown.side === aiAction && Number(lane.cooldown.until) > nowSec) blocked = 'cooldown';
    else if (confidence < minConfidence) blocked = 'low_conviction';
    else if (!mkt || !atr4 || stopCall === null || targetCall === null) blocked = 'invalid_setup';
    else {
      let limit = entryCall === null ? mkt : entryCall;
      if (dir * (limit - mkt) > 0) limit = mkt;
      limit = aiAction === 'long' ? floorTo(limit, digits) : ceilTo(limit, digits);
      showEntry = limit;
      const stopDistance = ((dir * (limit - stopCall)) / limit) * 100;
      const gain = ((dir * (targetCall - limit)) / limit) * 100;
      const atrPct = (atr4 / limit) * 100;
      const setupType = String(call.setupType || 'other');
      if (stopDistance <= 0 || gain <= 0) blocked = 'invalid_setup';
      else if (dir * (mkt - limit) > atr1 * 2.5) blocked = 'entry_too_far';
      else if (stopDistance < minStopAtr * atrPct) blocked = 'stop_too_tight';
      else if (stopDistance > Math.min(maxStopAtr * atrPct, maxStopPct)) blocked = 'stop_too_wide';
      else if ((gain - feeRT) / (stopDistance + feeRT) < minNetRR) blocked = 'weak_reward';
      else if ((setupType === 'trend_pullback' || setupType === 'breakout') && lane.ema20h4 && (dir * (limit - lane.ema20h4)) / atr4 > 3) blocked = 'overextended';
      else candidate = { lane: lane, action: aiAction, confidence: confidence, limit: limit, stop: stopCall, target: targetCall, sizePct: sizeCall, stopDistance: stopDistance, setupType: setupType };
    }
    if (blocked) side = null;
    else action = aiAction;
  }
  const coin = {
    symbol: lane.symbol,
    pair: lane.pair,
    action: action,
    aiAction: aiAction,
    setupType: call && call.setupType && call.setupType !== 'none' ? String(call.setupType) : pos ? pos.setupType || null : null,
    confidence: confidence,
    line: call && call.line ? String(call.line) : '',
    setup: call && call.setup ? String(call.setup) : '',
    invalidation: call && call.invalidation ? String(call.invalidation) : '',
    entry: showEntry,
    stop: showStop,
    target: showTarget,
    sizePct: showSize,
    side: side,
    pnlPct: pos ? pos.pnlPct : null,
    r: pos ? pos.rNow : null,
    note: notes.join(' '),
    blockedByRule: blocked,
    order: null,
    inPosition: Boolean(pos),
  };
  coins.push(coin);
  if (candidate) { candidate.coin = coin; candidates.push(candidate); }
}
let slots = Math.max(0, maxPositions - slotsUsed);
let eurLeft = Math.max(0, (Number(row.eurFree) || 0) - reserved) * 0.98;
const opens = [];
candidates.sort((left, right) => right.confidence - left.confidence);
for (const pick of candidates) {
  const coin = pick.coin;
  const lane = pick.lane;
  const digits = Number(lane.pdec) || 2;
  if (slots <= 0) { coin.action = 'hold'; coin.blockedByRule = 'max_positions'; coin.side = null; continue; }
  const riskCap = (riskPct / (pick.stopDistance + feeRT)) * 100;
  const pct = Math.min(maxSizePct, pick.sizePct === null ? maxSizePct : Math.max(5, pick.sizePct), riskCap);
  let sizeEur = (equity * pct) / 100;
  const perEuro = pick.action === 'long' ? 1 : 1 / leverage;
  if (sizeEur * perEuro > eurLeft) sizeEur = eurLeft / perEuro;
  if (sizeEur < 5) { coin.action = 'hold'; coin.blockedByRule = 'max_size'; coin.side = null; continue; }
  const volume = sizeEur / pick.limit;
  if (volume < lane.ordermin) { coin.action = 'hold'; coin.blockedByRule = 'below_minimum'; coin.side = null; continue; }
  coin.sizePct = Number(((sizeEur / (equity || sizeEur)) * 100).toFixed(1));
  coin.stop = Number(Number(pick.stop).toFixed(digits));
  coin.target = Number(Number(pick.target).toFixed(digits));
  opens.push({
    kind: 'open', symbol: lane.symbol, pair: lane.pair, side: pick.action, volume: volume.toFixed(8),
    limit: pick.limit.toFixed(digits), stop: Number(pick.stop).toFixed(digits), target: coin.target, last: lane.last, sizeEur: Number(sizeEur.toFixed(2)),
    leverage: leverage, userref: userref, expire: nowSec + Math.round(Number(config.entryTtlMin) * 60),
    setup: coin.setup, setupType: pick.setupType, invalidation: coin.invalidation, trend: lane.trend,
  });
  eurLeft -= sizeEur * perEuro;
  slots -= 1;
}
const orders = cancels.concat(closes, amends, opens);
return [{ json: {
  pair: 'ten',
  action: opens.length || closes.length ? 'trade' : amends.length ? 'manage' : 'hold',
  aiAction: null,
  reason: row.reason || '',
  thesis: row.thesis || '',
  invalidation: '',
  mood: row.mood || '',
  confidence: null,
  blockedByRule: hardBlock || softBlock,
  order: null,
  equityQuote: row.equityEur,
  dayPnlPct: pnl,
  inPosition: coins.some((coin) => coin.inPosition),
  fees: fees,
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
} else if (order.kind === 'amend') {
  path = '/0/private/AmendOrder';
  postData += '&txid=' + encodeURIComponent(order.txid) + '&trigger_price=' + order.stop;
} else if (order.kind === 'close') {
  postData += '&ordertype=market&pair=' + encodeURIComponent(order.pair) + '&volume=' + order.volume;
  if (order.side === 'long') postData += '&type=sell';
  else postData += '&type=buy&leverage=' + order.leverage + '&reduce_only=true';
} else if (order.kind === 'stop') {
  postData += '&ordertype=stop-loss&pair=' + encodeURIComponent(order.pair) + '&volume=' + order.volume + '&price=' + order.stop + '&userref=' + order.userref;
  if (order.side === 'long') postData += '&type=sell';
  else postData += '&type=buy&leverage=' + order.leverage + '&reduce_only=true';
} else {
  postData += '&ordertype=limit&pair=' + encodeURIComponent(order.pair) + '&volume=' + order.volume + '&price=' + order.limit;
  postData += '&oflags=post&timeinforce=GTD&expiretm=' + order.expire + '&userref=' + order.userref;
  postData += '&type=' + (order.side === 'long' ? 'buy' : 'sell');
  if (order.side === 'short') postData += '&leverage=' + order.leverage;
  postData += '&close%5Bordertype%5D=stop-loss&close%5Bprice%5D=' + order.stop;
}
const signed = sign(path, postData);
return [{ json: { apiSign: signed.apiSign, postData: signed.postData, path: path } }];`;

const recordCode = `const response = $input.first().json;
const store = $getWorkflowStaticData('global');
const order = store.scratch && store.scratch.pending ? store.scratch.pending : {};
if (!Array.isArray(store.scratch.fills)) store.scratch.fills = [];
const errors = Array.isArray(response.error) ? response.error.filter(Boolean) : [];
const message = response.error && !Array.isArray(response.error) ? String(response.error.message || response.error) : '';
const result = response.result || {};
const txid = Array.isArray(result.txid) ? result.txid[0] : null;
const descr = result.descr ? result.descr.order : null;
const failed = errors.length > 0 || Boolean(message);
let rejected = failed || !txid;
if (order.kind === 'cancel') rejected = failed;
if (order.kind === 'amend') rejected = failed || !result.amend_id;
store.scratch.fills.push({ order: order, rejected: rejected, txid: txid, descr: descr, note: errors.join(', ') || message || '' });
return [{ json: { pair: order.pair, kind: order.kind, rejected: rejected } }];`;

const assembleCode = `function clock(seconds) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(new Date(seconds * 1000));
}
function sg(value) {
  return (value > 0 ? '+' : '') + Number(value).toFixed(2);
}
const gate = $('Risk Gate').first().json;
const config = $('Desk Config').first().json;
const store = $getWorkflowStaticData('global');
if (!store.positions || typeof store.positions !== 'object') store.positions = {};
if (!store.pending || typeof store.pending !== 'object') store.pending = {};
if (!store.cooldown || typeof store.cooldown !== 'object') store.cooldown = {};
if (!Array.isArray(store.history)) store.history = [];
const positions = store.positions;
const fills = store.scratch && Array.isArray(store.scratch.fills) ? store.scratch.fills : [];
const now = Math.floor(Date.now() / 1000);
const feeRT = gate.fees ? Number(gate.fees.maker) + Number(gate.fees.taker) : Number(config.makerFeePct) + Number(config.takerFeePct);
const reasons = { target_hit: 'target reached', model_close: 'closed by Orbit', time_stop: 'time stop', trail_exit: 'protective stop by the desk', stop_missing: 'closed, the stop was gone' };
const coins = (Array.isArray(gate.coins) ? gate.coins : []).map((coin) => {
  const mine = fills.filter((fill) => fill.order && fill.order.pair === coin.pair);
  if (!mine.length) return coin;
  const next = Object.assign({}, coin);
  const notes = coin.note ? [coin.note] : [];
  const stopCancelled = mine.some((fill) => fill.order.kind === 'cancel' && !fill.order.pending && !fill.rejected);
  const stopCancelFailed = mine.some((fill) => fill.order.kind === 'cancel' && !fill.order.pending && fill.rejected);
  for (const fill of mine) {
    const order = fill.order;
    const pos = positions[coin.pair];
    if (order.kind === 'cancel' && order.pending) {
      if (!fill.rejected && store.pending[coin.pair]) store.pending[coin.pair].cancelled = true;
      notes.push(fill.rejected ? 'Kraken did not cancel the resting order' + (fill.note ? ': ' + fill.note : '.') : 'The resting limit order is cancelled.');
    }
    if (order.kind === 'close') {
      if (fill.rejected) {
        if (pos && stopCancelled) pos.stopMissing = true;
        next.action = 'hold';
        next.blockedByRule = 'exchange_rejected';
        notes.push('Kraken rejected the close' + (fill.note ? ': ' + fill.note : '.') + (stopCancelled ? ' The stop is gone, so the desk retries next round.' : ''));
      } else {
        if (pos && pos.entry && order.last) {
          const dir = pos.side === 'long' ? 1 : -1;
          const gross = ((dir * (order.last - pos.entry)) / pos.entry) * 100;
          const net = gross - feeRT;
          const risk = Math.abs(pos.entry - (pos.initStop || pos.stop));
          store.history.push({
            symbol: coin.symbol, side: pos.side, setupType: pos.setupType || 'other', grossPct: gross, netPct: net,
            r: risk > 0 ? (dir * (order.last - pos.entry)) / risk : null, hours: (now - Number(pos.openedAt)) / 3600, how: reasons[order.why] || 'closed by the desk', at: now,
          });
          if (store.history.length > 40) store.history = store.history.slice(-40);
          if (net < 0) store.cooldown[coin.pair] = { side: pos.side, until: now + Number(config.cooldownHours) * 3600 };
          notes.push('Closed near ' + order.last + ': ' + sg(gross) + '% on the price, about ' + sg(net) + '% after fees.');
        }
        if (stopCancelFailed) notes.push('Kraken did not cancel the old stop order. Check open orders on Kraken.');
        delete positions[coin.pair];
        next.inPosition = false;
        next.order = { type: 'market', side: order.side === 'long' ? 'sell' : 'buy', volume: String(order.volume), txid: fill.txid, descr: fill.descr };
      }
    }
    if (order.kind === 'amend') {
      if (fill.rejected) notes.push('Kraken did not move the stop to ' + order.stop + (fill.note ? ': ' + fill.note : '.') + ' The old stop stays.');
      else {
        if (pos) pos.stop = Number(order.stop);
        next.stop = Number(order.stop);
        notes.push('Stop moved to ' + order.stop + ' (' + order.why + ').');
      }
    }
    if (order.kind === 'stop') {
      if (fill.rejected) notes.push('No stop order was live and Kraken refused a new one' + (fill.note ? ': ' + fill.note : '.') + ' Check this position on Kraken.');
      else {
        if (pos) pos.stop = Number(order.stop);
        next.stop = Number(order.stop);
        notes.push('A new stop order sits at ' + order.stop + ' (' + order.why + ').');
      }
    }
    if (order.kind === 'open') {
      if (fill.rejected) {
        next.action = 'hold';
        next.side = null;
        next.blockedByRule = 'exchange_rejected';
        notes.push('Kraken rejected the order' + (fill.note ? ': ' + fill.note : '.'));
      } else {
        store.pending[coin.pair] = {
          txid: fill.txid, side: order.side, limit: Number(order.limit), volume: Number(order.volume), stop: Number(order.stop), target: Number(order.target),
          placedAt: now, expireAt: Number(order.expire), sizeEur: order.sizeEur, setup: order.setup || '', setupType: order.setupType || 'other', invalidation: order.invalidation || '', trend: order.trend,
        };
        next.entry = Number(order.limit);
        next.order = { type: 'limit', side: order.side === 'long' ? 'buy' : 'sell', volume: String(order.volume), txid: fill.txid, descr: fill.descr };
        notes.push('Limit order resting at ' + order.limit + ' until ' + clock(Number(order.expire)) + '. It becomes a position only if the price comes to it.');
      }
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

const keysNoteText = 'Kraken key and secret live in the data table orbit_kraken. No withdraw permission. Shorts run on Kraken margin with the same key, so margin must be enabled on the account. Without the row Orbit reads prices and writes wait.';
const gateNoteText = 'Every round the Risk Gate first runs the desk rules on open positions: target touched, break-even at +1R, trailing from +1.5R, time stop. Then it checks what Orbit proposes: at most two positions, 45% each, a stop inside the ATR band, a target that pays the fees, conviction above 0.62. Entries are resting limit orders with a stop-loss attached. There is no daily limit. The numbers live on Desk Config.';
const publishNoteText = 'Published means every hour, two minutes past. Run Now is the webhook behind the app button, guarded by the x-orbit-token header; sync.mjs sets it from ORBIT_RUN_TOKEN. Do not use Manual watch with live keys: a manual run trades but does not remember its positions.';

const hourly = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.4, config: { name: 'Hourly Watch', parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 2 }] } }, output: [{ scheduled: true }] } });
const runNow = trigger({ type: 'n8n-nodes-base.webhook', version: 2.2, config: { name: 'Run Now', parameters: { httpMethod: 'POST', path: 'orbit-run-now', authentication: 'none', responseMode: 'onReceived', options: { noResponseBody: true } }, output: [{ headers: {} }] } });
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
const orbit = node({ type: '@n8n/n8n-nodes-langchain.openAi', version: 2.3, config: { name: 'Orbit', executeOnce: true, onError: 'continueErrorOutput', credentials: { openAiApi: newCredential('OpenAi account') }, parameters: { resource: 'text', operation: 'response', modelId: { __rl: true, mode: 'list', value: 'gpt-5.6-luna', cachedResultName: 'GPT-5.6-LUNA' }, simplify: true, responses: { values: [{ type: 'text', role: 'system', content: instructions }, { type: 'text', role: 'user', content: expr('{{ $json.brief }}') }] }, options: { maxTokens: 20000, store: false, reasoning: { reasoningOptions: { effort: 'high', summary: 'concise' } }, textFormat: { textOptions: { type: 'json_schema', name: 'orbit_round', description: 'The journal of this round and the decision for each coin.', strict: true, schema: roundSchema } } } }, output: [{ output: '{"thesis":"I am waiting."}' }] } });
const offline = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Model Offline', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: offlineCode }, output: [{ offline: true, calls: [] }] } });
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
  .add(runNow)
  .to(desk)
  .add(manual)
  .to(desk)
  .add(dossier)
  .to(orbit.onError(offline.to(gate)))
  .add(orbit)
  .to(journal)
  .to(gate)
  .to(place.onTrue(fanOrders.to(orderLoop.onEachBatch(signOrder.to(sendOrder).to(record).to(nextBatch(orderLoop))).onDone(assemble.to(decision)))).onFalse(decision))
  .add(keysNote)
  .add(gateNote)
  .add(publishNote)
  .group('Market', [desk, ticker, scratch, fan], { description: 'The ten pairs, the ticker, and the empty scratch pad for this round.' })
  .group('Account', [signBalance, fetchBalance, signOrders, fetchOrders, signTrades, fetchTrades], { description: 'Balance, open orders and trades. Only when the keys are present.' })
  .group('Order', [signOrder, sendOrder, record], { description: 'Cancels, closes, stop moves, then new limit entries. Every entry carries a stop-loss on Kraken.' });
