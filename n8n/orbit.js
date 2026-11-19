import { workflow, node, trigger, ifElse, sticky, newCredential, expr, splitInBatches, nextBatch } from '@n8n/workflow-sdk';

const lanesJson = '[{"symbol":"BTC","pair":"XXBTZEUR","asset":"XXBT"},{"symbol":"ETH","pair":"XETHZEUR","asset":"XETH"},{"symbol":"SOL","pair":"SOLEUR","asset":"SOL"},{"symbol":"XRP","pair":"XXRPZEUR","asset":"XXRP"},{"symbol":"ADA","pair":"ADAEUR","asset":"ADA"},{"symbol":"DOGE","pair":"XDGEUR","asset":"XXDG"},{"symbol":"LINK","pair":"LINKEUR","asset":"LINK"},{"symbol":"AVAX","pair":"AVAXEUR","asset":"AVAX"},{"symbol":"DOT","pair":"DOTEUR","asset":"DOT"},{"symbol":"LTC","pair":"XLTCZEUR","asset":"XLTC"}]';

const pairQuery = 'XXBTZEUR,XETHZEUR,SOLEUR,XXRPZEUR,ADAEUR,XDGEUR,LINKEUR,AVAXEUR,DOTEUR,XLTCZEUR';

const instructions = `You are Orbit. Once an hour you walk ten Kraken spot pairs, all against euro: BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX, DOT and LTC. No leverage. No eleventh pair. No story about a market that is not in the dossier.

Write in English, in the first person, as if the journal will be read aloud tomorrow morning from a quiet desk in a dark room. A thin ring of light on the page. Concrete. Every judgment hangs on a number from the dossier: a price, a candle, a distance to the line, a position already open. Forbidden sentences: the market is volatile, this is not financial advice, I see opportunities.

The mandate is one day. At midnight in Amsterdam the count starts again. Plus one percent on this desk's equity is a line to watch, not a quota to force. Once the line is reached, you do not buy again that day. Most lanes stay empty. Empty is a decision, and you write it with the same care as a buy.

Per coin you may buy, sell, or wait.
A buy opens a position paid in euro, never larger than the maximum in the dossier, and only if this desk does not already hold that coin.
A sell closes only the amount this desk bought itself. Balance that was already on the Kraken account before Orbit bought it stays put. You do not sell that.
Waiting leaves the lane empty.

Count the toll. One leg costs about the taker percentage in the dossier, a round trip twice that. A move that does not cover the toll is not an idea.

confidence is a number between 0 and 1. Below the threshold in the dossier you do not buy that coin. A sell may carry lower conviction, because an open position is a decision you still have to be willing to close.

thesis is one sentence for the whole round.
reason is the journal of the round, between 90 and 170 words. Name the number that decided it, and which lanes you deliberately left empty.
mood is one word for the mood on the desk. No emoji.
coins contains exactly the ten pairs from the dossier, in the same order, with the pair field exactly as in the dossier. line is one sentence for that lane. invalidation is the concrete condition that would make that lane wrong this hour.

Reply only in the requested schema.`;

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
store.scratch = { runId: String($execution.id), candles: {}, fills: {}, pending: null };
return $input.all();`;

const fanCode = `const config = $('Desk Config').first().json;
let lanes = [];
try { lanes = JSON.parse(config.lanes); } catch (error) { lanes = []; }
return lanes.map((lane) => ({ json: { symbol: lane.symbol, pair: lane.pair, asset: lane.asset } }));`;

const stashCode = `const body = $input.first().json;
const result = body && body.result && typeof body.result === 'object' ? body.result : {};
const store = $getWorkflowStaticData('global');
if (!store.scratch || typeof store.scratch !== 'object') {
  store.scratch = { runId: String($execution.id), candles: {}, fills: {}, pending: null };
}
if (!store.scratch.candles) store.scratch.candles = {};
const names = Object.keys(result);
for (const name of names) {
  if (Array.isArray(result[name])) store.scratch.candles[name] = result[name];
}
return [{ json: { stashed: names[0] || '', rows: names[0] && Array.isArray(result[names[0]]) ? result[names[0]].length : 0 } }];`;

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
function money(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'unknown';
  return Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function coinText(value) {
  if (!Number.isFinite(Number(value))) return '0';
  return Number(value).toLocaleString('en-GB', { maximumFractionDigits: 8 });
}
function balanceOf(balances, asset) {
  const names = [asset];
  if (asset === 'XXBT') names.push('XBT');
  if (asset === 'XETH') names.push('ETH');
  if (asset === 'XXRP') names.push('XRP');
  if (asset === 'XXDG') names.push('XDG');
  if (asset === 'XLTC') names.push('LTC');
  for (const name of names) {
    if (balances[name] !== undefined) return num(balances[name]) || 0;
  }
  return 0;
}
const config = $('Desk Config').first().json;
let laneDefs = [];
try { laneDefs = JSON.parse(config.lanes); } catch (error) { laneDefs = []; }
const tickerBody = $('Ticker').first().json;
const quotes = tickerBody && tickerBody.result ? tickerBody.result : {};
const store = $getWorkflowStaticData('global');
const candles = store.scratch && store.scratch.candles ? store.scratch.candles : {};
if (!store.book || typeof store.book !== 'object') store.book = {};
const book = store.book;
const keys = $('Keys Present').first().json;
let balanceBody = null;
let ordersBody = null;
let tradesBody = null;
try { balanceBody = $('Fetch Balance').first().json; } catch (error) { balanceBody = null; }
try { ordersBody = $('Fetch Open Orders').first().json; } catch (error) { ordersBody = null; }
try { tradesBody = $('Fetch Trades').first().json; } catch (error) { tradesBody = null; }
const exchangeErrors = [];
if (balanceBody && Array.isArray(balanceBody.error) && balanceBody.error.length) exchangeErrors.push(balanceBody.error.join(', '));
if (ordersBody && Array.isArray(ordersBody.error) && ordersBody.error.length) exchangeErrors.push(ordersBody.error.join(', '));
if (tradesBody && Array.isArray(tradesBody.error) && tradesBody.error.length) exchangeErrors.push(tradesBody.error.join(', '));
const balances = balanceBody && balanceBody.result ? balanceBody.result : {};
const eurFree = num(balances.ZEUR) || 0;
const dust = Number(config.dustEur);
const lanes = [];
let bookValue = 0;
for (const lane of laneDefs) {
  const quote = quotes[lane.pair] || {};
  const last = num(quote.c && quote.c[0]);
  const bid = num(quote.b && quote.b[0]);
  const ask = num(quote.a && quote.a[0]);
  const open = num(quote.o);
  const low = num(quote.l && quote.l[1]);
  const high = num(quote.h && quote.h[1]);
  const bookBase = num(book[lane.pair]) || 0;
  const notional = last ? bookBase * last : 0;
  if (last) bookValue += notional;
  const rows = Array.isArray(candles[lane.pair]) ? candles[lane.pair] : [];
  const bits = [];
  for (const row of rows.slice(-8)) {
    const close = num(row[4]);
    const barOpen = num(row[1]);
    let move = 'n/a';
    if (barOpen && close) move = (((close - barOpen) / barOpen) * 100).toFixed(2) + '%';
    bits.push(money(close) + ' (' + move + ')');
  }
  lanes.push({
    symbol: lane.symbol,
    pair: lane.pair,
    asset: lane.asset,
    last: last,
    bid: bid,
    ask: ask,
    open: open,
    low: low,
    high: high,
    bookBase: bookBase,
    notional: notional,
    holding: bookBase > 0 && notional > dust,
    wallet: balanceOf(balances, lane.asset),
    candleLine: bits.join(' | ') || 'no candles',
  });
}
const equityEur = keys.hasKeys ? eurFree + bookValue : null;
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
const tradeMap = tradesBody && tradesBody.result && tradesBody.result.trades ? tradesBody.result.trades : {};
const tradeLines = [];
for (const id of Object.keys(tradeMap)) {
  const trade = tradeMap[id];
  if (dayKey(new Date(Number(trade.time) * 1000)) !== today) continue;
  tradeLines.push(String(trade.pair || '') + ' ' + trade.type + ' ' + trade.vol + ' at ' + trade.price);
}
const lines = ['DESK DOSSIER', 'Time in Amsterdam: ' + clock(new Date()), 'Ten spot pairs, no leverage. Own positions only.'];
for (const lane of lanes) {
  lines.push(lane.symbol + ' pair ' + lane.pair + '. Last ' + money(lane.last) + '. Bid / ask ' + money(lane.bid) + ' / ' + money(lane.ask) + '. Open ' + money(lane.open) + '. High / low 24 hours ' + money(lane.high) + ' / ' + money(lane.low) + '.');
  lines.push('Hourly candles, old to new, close (move): ' + lane.candleLine + '.');
  lines.push('Own position: ' + coinText(lane.bookBase) + ' ' + lane.symbol + ', about ' + money(lane.notional) + ' euro. Held by Orbit: ' + (lane.holding ? 'yes' : 'no') + '.');
}
lines.push('Line: +' + config.dailyTargetPct + '%. Above it, no new buy.');
lines.push('Hard loss limit: ' + config.dailyLossPct + '%. Below it, no new buy. An open position may still be closed.');
lines.push('Maximum buy per coin: ' + config.maxOrderEur + ' euro. Minimum conviction: ' + config.minBuyConfidence + '. Toll per leg: ' + config.takerFeePct + '%.');
if (keys.hasKeys) {
  lines.push('Free euro: ' + money(eurFree) + '. Equity of this desk: ' + money(equityEur) + ' euro. Start of the day: ' + money(dayStart) + ' euro. Day result: ' + (dayPnlPct === null ? 'unknown' : dayPnlPct.toFixed(3) + '%') + '.');
  lines.push('This equity is free euro plus the holdings Orbit bought, not the whole Kraken account. Wallet balance Orbit did not buy stays outside the lane.');
} else {
  lines.push('The Kraken keys are not in the n8n variables KRAKEN_API_KEY and KRAKEN_API_SECRET yet. You may think. You may not trade.');
}
lines.push(exchangeErrors.length ? 'Kraken said: ' + exchangeErrors.join(' | ') : 'Kraken returned no error on the account.');
lines.push('Trades today: ' + (tradeLines.length ? tradeLines.join(' | ') : 'none.'));
const brief = lines.join(String.fromCharCode(10));
return [{ json: { brief: brief, hasKeys: Boolean(keys.hasKeys), exchangeError: exchangeErrors.join(' | '), equityEur: equityEur, dayPnlPct: dayPnlPct, eurFree: eurFree, lanes: lanes } }];`;

const journalCode = `function textFrom(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if (typeof value.output === 'string') return value.output;
  if (typeof value.text === 'string') return value.text;
  if (typeof value.message === 'string') return value.message;
  if (value.thesis || value.coins) return JSON.stringify(value);
  const chunks = [];
  const output = value.output;
  if (Array.isArray(output)) {
    for (const part of output) {
      if (typeof part === 'string') chunks.push(part);
      if (part && typeof part.text === 'string') chunks.push(part.text);
      if (part && Array.isArray(part.content)) {
        for (const block of part.content) {
          if (typeof block === 'string') chunks.push(block);
          if (block && typeof block.text === 'string') chunks.push(block.text);
        }
      }
    }
  }
  if (chunks.length) return chunks.join(String.fromCharCode(10));
  return JSON.stringify(value);
}
const item = $input.first().json;
let raw = textFrom(item).trim();
const fence = String.fromCharCode(96).repeat(3);
if (raw.startsWith(fence)) {
  raw = raw.slice(fence.length).trim();
  if (raw.toLowerCase().startsWith('json')) raw = raw.slice(4).trim();
  if (raw.endsWith(fence)) raw = raw.slice(0, -fence.length).trim();
}
let parsed = null;
try { parsed = JSON.parse(raw); } catch (error) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch (inner) { parsed = null; }
  }
}
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
  reason: parsed && parsed.reason ? String(parsed.reason) : raw.slice(0, 1600),
  mood: parsed && parsed.mood ? String(parsed.mood) : '',
  calls: calls,
  parseError: !parsed || !calls.length,
} }];`;

const gateCode = `function findCall(calls, lane) {
  const symbol = String(lane.symbol || '').toUpperCase();
  const pair = String(lane.pair || '').toUpperCase();
  for (const call of calls) {
    const key = String(call.pair || call.symbol || '').toUpperCase().replace('/EUR', '').replace('EUR', '');
    const raw = String(call.pair || '').toUpperCase();
    if (raw === pair || raw === symbol || key === symbol || key === pair) return call;
  }
  return null;
}
const row = $input.first().json;
const config = $('Desk Config').first().json;
const maxOrder = Number(config.maxOrderEur);
const lossLimit = Number(config.dailyLossPct);
const target = Number(config.dailyTargetPct);
const minBuy = Number(config.minBuyConfidence);
const lanes = Array.isArray(row.lanes) ? row.lanes : [];
const calls = Array.isArray(row.calls) ? row.calls : [];
const pnl = typeof row.dayPnlPct === 'number' ? row.dayPnlPct : null;
let bookBlock = null;
if (!row.hasKeys) bookBlock = 'missing_credentials';
else if (row.exchangeError) bookBlock = 'account_unreadable';
else if (row.parseError) bookBlock = 'unreadable';
const loss = pnl !== null && pnl <= lossLimit;
const topped = pnl !== null && pnl >= target;
let eurLeft = Number(row.eurFree) || 0;
const coins = [];
const orders = [];
for (const lane of lanes) {
  const call = findCall(calls, lane);
  let action = call && (call.action === 'buy' || call.action === 'sell' || call.action === 'hold') ? call.action : 'hold';
  const confidence = call && Number.isFinite(Number(call.confidence)) ? Number(call.confidence) : 0;
  let blocked = null;
  const holding = Boolean(lane.holding);
  if (bookBlock) { action = 'hold'; blocked = bookBlock; }
  else if (!call) { action = 'hold'; blocked = 'unreadable'; }
  else if (loss && action === 'buy') { action = 'hold'; blocked = 'daily_loss'; }
  else if (topped && action === 'buy') { action = 'hold'; blocked = 'target_reached'; }
  else if (action === 'buy' && holding) { action = 'hold'; blocked = 'already_in_position'; }
  else if (action === 'sell' && !holding) { action = 'hold'; blocked = 'already_flat'; }
  else if (action === 'buy' && confidence < minBuy) { action = 'hold'; blocked = 'low_conviction'; }
  else if (action === 'buy' && (!lane.last || eurLeft < maxOrder)) { action = 'hold'; blocked = 'max_size'; }
  let volume = null;
  if (action === 'buy') {
    volume = maxOrder.toFixed(2);
    eurLeft -= maxOrder;
  }
  if (action === 'sell') volume = Number(lane.bookBase || 0).toFixed(8);
  coins.push({
    symbol: lane.symbol,
    pair: lane.pair,
    action: action,
    aiAction: call ? call.action : 'hold',
    confidence: confidence,
    line: call && call.line ? String(call.line) : '',
    invalidation: call && call.invalidation ? String(call.invalidation) : '',
    blockedByRule: blocked,
    order: null,
    inPosition: holding,
  });
  if (action === 'buy' || action === 'sell') {
    orders.push({ symbol: lane.symbol, pair: lane.pair, asset: lane.asset, action: action, volume: volume, last: lane.last });
  }
}
orders.sort((left, right) => (left.action === 'sell' ? 0 : 1) - (right.action === 'sell' ? 0 : 1));
const buys = coins.filter((coin) => coin.action === 'buy').length;
const sells = coins.filter((coin) => coin.action === 'sell').length;
let action = 'hold';
if (buys && sells) action = null;
else if (buys) action = 'buy';
else if (sells) action = 'sell';
return [{ json: {
  pair: 'ten',
  action: action,
  aiAction: action,
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
const store = $getWorkflowStaticData('global');
if (!store.scratch) store.scratch = { fills: {}, pending: null };
store.scratch.pending = order;
const path = '/0/private/AddOrder';
let postData = 'nonce=' + nonce + '&ordertype=market&pair=' + encodeURIComponent(order.pair) + '&type=' + order.action + '&volume=' + order.volume;
if (order.action === 'buy') postData += '&oflags=viqc';
const signed = sign(path, postData);
return [{ json: { apiSign: signed.apiSign, postData: signed.postData } }];`;

const recordCode = `const response = $input.first().json;
const store = $getWorkflowStaticData('global');
const pending = store.scratch && store.scratch.pending ? store.scratch.pending : {};
if (!store.scratch.fills) store.scratch.fills = {};
const errors = Array.isArray(response.error) ? response.error.filter(Boolean) : [];
const message = response.error && !Array.isArray(response.error) ? String(response.error.message || response.error) : '';
const txid = response.result && Array.isArray(response.result.txid) ? response.result.txid[0] : null;
const descr = response.result && response.result.descr ? response.result.descr.order : null;
const rejected = errors.length > 0 || Boolean(message) || !txid;
store.scratch.fills[pending.pair] = {
  rejected: rejected,
  txid: txid,
  descr: descr,
  note: errors.join(', ') || message || '',
  volume: pending.volume,
  last: pending.last,
  action: pending.action,
};
return [{ json: { pair: pending.pair, rejected: rejected } }];`;

const assembleCode = `const gate = $('Risk Gate').first().json;
const config = $('Desk Config').first().json;
const fee = Number(config.takerFeePct) || 0;
const store = $getWorkflowStaticData('global');
if (!store.book || typeof store.book !== 'object') store.book = {};
const fills = store.scratch && store.scratch.fills ? store.scratch.fills : {};
const coins = (Array.isArray(gate.coins) ? gate.coins : []).map((coin) => {
  const fill = fills[coin.pair];
  if (!fill) return coin;
  if (fill.rejected) {
    const note = fill.note ? ' Kraken rejected the order: ' + fill.note : ' Kraken rejected the order.';
    return {
      symbol: coin.symbol, pair: coin.pair, action: 'hold', aiAction: coin.aiAction, confidence: coin.confidence,
      line: (coin.line || '') + note, invalidation: coin.invalidation, blockedByRule: 'exchange_rejected', order: null, inPosition: coin.inPosition,
    };
  }
  const last = Number(fill.last) || 0;
  const quote = Number(fill.volume) || 0;
  if (fill.action === 'buy' && last > 0) {
    const got = (quote / last) * (1 - fee / 100) * 0.995;
    store.book[coin.pair] = (Number(store.book[coin.pair]) || 0) + got;
  }
  if (fill.action === 'sell') store.book[coin.pair] = 0;
  return {
    symbol: coin.symbol, pair: coin.pair, action: coin.action, aiAction: coin.aiAction, confidence: coin.confidence,
    line: coin.line, invalidation: coin.invalidation, blockedByRule: null, inPosition: fill.action === 'buy',
    order: { type: 'market', side: fill.action, volume: String(fill.volume), txid: fill.txid, descr: fill.descr },
  };
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
  blockedByRule: 'model_offline', order: null, inPosition: Boolean(lane.holding),
}));
return [{ json: {
  pair: 'ten', action: 'hold', aiAction: 'hold',
  reason: 'The ring on the desk is lit, but OpenAI did not answer. Until it does, Orbit writes no order.',
  thesis: 'No model, no order.', invalidation: '', mood: 'waiting', confidence: null,
  blockedByRule: 'model_offline', order: null,
  equityQuote: dossier.equityEur === undefined ? null : dossier.equityEur,
  dayPnlPct: dossier.dayPnlPct === undefined ? null : dossier.dayPnlPct,
  inPosition: false, coins: coins, orders: [], placeAny: false, at: new Date().toISOString(),
} }];`;

const hourly = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.4, config: { name: 'Hourly Watch', parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 2 }] } }, output: [{ scheduled: true }] } });
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Manual watch', output: [{ manual: true }] } });
const desk = node({ type: 'n8n-nodes-base.set', version: 3.5, config: { name: 'Desk Config', executeOnce: true, parameters: { mode: 'manual', includeOtherFields: false, assignments: { assignments: [ { id: 'lanes', name: 'lanes', value: lanesJson, type: 'string' }, { id: 'query', name: 'pairQuery', value: pairQuery, type: 'string' }, { id: 'max', name: 'maxOrderEur', value: 15, type: 'number' }, { id: 'loss', name: 'dailyLossPct', value: -0.5, type: 'number' }, { id: 'target', name: 'dailyTargetPct', value: 1, type: 'number' }, { id: 'conv', name: 'minBuyConfidence', value: 0.62, type: 'number' }, { id: 'fee', name: 'takerFeePct', value: 0.4, type: 'number' }, { id: 'dust', name: 'dustEur', value: 1, type: 'number' } ] } }, output: [{ pairQuery: pairQuery, maxOrderEur: 15 }] } });
const krakenKeys = node({ type: 'n8n-nodes-base.dataTable', version: 1.1, config: { name: 'Kraken Keys', executeOnce: true, parameters: { resource: 'row', operation: 'get', returnAll: true, dataTableId: { __rl: true, mode: 'id', value: 'RUTyxzyDwwWH97no', cachedResultName: 'orbit_kraken' } }, output: [{ krakenApiKey: '', krakenApiSecret: '' }] } });
const ticker = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Ticker', executeOnce: true, parameters: { method: 'GET', url: expr('{{ "https://api.kraken.com/0/public/Ticker?pair=" + $json.pairQuery }}'), authentication: 'none', options: { response: { response: { responseFormat: 'json' } } } }, output: [{ error: [], result: {} }] } });
const scratch = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Open Scratch', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: scratchCode }, output: [{ ok: true }] } });
const fan = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Fan Lanes', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: fanCode }, output: [{ symbol: 'BTC', pair: 'XXBTZEUR', asset: 'XXBT' }] } });
const pause = node({ type: 'n8n-nodes-base.wait', version: 1.1, config: { name: 'Pause', parameters: { resume: 'timeInterval', amount: 1, unit: 'seconds' }, output: [{ symbol: 'BTC', pair: 'XXBTZEUR' }] } });
const candle = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Hourly candle', parameters: { method: 'GET', url: expr('{{ "https://api.kraken.com/0/public/OHLC?pair=" + $json.pair + "&interval=60" }}'), authentication: 'none', options: { response: { response: { responseFormat: 'json' } } } }, output: [{ error: [], result: { XXBTZEUR: [[1700000000, '1', '1', '1', '1', '1', '1', 1]] } }] } });
const stash = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Stash candle', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: stashCode }, output: [{ stashed: 'XXBTZEUR', rows: 1 }] } });
const candleLoop = splitInBatches({ version: 3, config: { name: 'Candle Lanes', parameters: { batchSize: 1 } } });
const keysPresent = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Keys Present', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "let key = '';\nlet secret = '';\ntry { const row = $('Kraken Keys').first().json; key = String(row.krakenApiKey || '').trim(); secret = String(row.krakenApiSecret || '').trim(); } catch (error) { key = ''; secret = ''; }\nreturn [{ json: { hasKeys: key.length > 0 && secret.length > 0 } }];" }, output: [{ hasKeys: false }] } });
const keysReady = ifElse({ version: 2.4, config: { name: 'Keys Ready?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ leftValue: expr('{{ $json.hasKeys }}'), rightValue: true, operator: { type: 'boolean', operation: 'true' } }], combinator: 'and' } }, output: [{ hasKeys: true }] } });
const privateHttp = { authentication: 'none', sendHeaders: true, specifyHeaders: 'keypair', headerParameters: { parameters: [{ name: 'API-Key', value: expr("{{ $('Kraken Keys').first().json.krakenApiKey }}") }, { name: 'API-Sign', value: expr('{{ $json.apiSign }}') }] }, sendBody: true, contentType: 'raw', rawContentType: 'application/x-www-form-urlencoded', body: expr('{{ $json.postData }}'), options: { lowercaseHeaders: false, response: { response: { responseFormat: 'json' } } } };
const signBalance = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Sign Balance', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: signer + "const signed = sign('/0/private/Balance', 'nonce=' + nonce);\nreturn [{ json: signed }];" }, output: [{ apiSign: 'sign', postData: 'nonce=1' }] } });
const fetchBalance = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Fetch Balance', executeOnce: true, parameters: { method: 'POST', url: 'https://api.kraken.com/0/private/Balance', ...privateHttp }, output: [{ error: [], result: { ZEUR: '100' } }] } });
const signOrders = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Sign Open Orders', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: signer + "const signed = sign('/0/private/OpenOrders', 'nonce=' + nonce);\nreturn [{ json: signed }];" }, output: [{ apiSign: 'sign', postData: 'nonce=2' }] } });
const fetchOrders = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Fetch Open Orders', executeOnce: true, parameters: { method: 'POST', url: 'https://api.kraken.com/0/private/OpenOrders', ...privateHttp }, output: [{ error: [], result: { open: {} } }] } });
const signTrades = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Sign Trades', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: signer + "const signed = sign('/0/private/TradesHistory', 'nonce=' + nonce);\nreturn [{ json: signed }];" }, output: [{ apiSign: 'sign', postData: 'nonce=3' }] } });
const fetchTrades = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Fetch Trades', executeOnce: true, parameters: { method: 'POST', url: 'https://api.kraken.com/0/private/TradesHistory', ...privateHttp }, output: [{ error: [], result: { trades: {} } }] } });
const dossier = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Dossier', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: dossierCode }, output: [{ brief: 'DOSSIER', hasKeys: false, lanes: [] }] } });
const orbit = node({ type: '@n8n/n8n-nodes-langchain.openAi', version: 2.3, config: { name: 'Orbit', executeOnce: true, onError: 'continueErrorOutput', credentials: { openAiApi: newCredential('OpenAi account') }, parameters: { resource: 'text', operation: 'response', modelId: { __rl: true, mode: 'id', value: 'gpt-5.4', cachedResultName: 'GPT-5.4' }, simplify: true, responses: { values: [{ type: 'text', role: 'system', content: instructions }, { type: 'text', role: 'user', content: expr('{{ $json.brief }}') }] }, options: { maxTokens: 4000, store: false, reasoning: { reasoningOptions: { effort: 'medium', summary: 'concise' } }, textFormat: { textOptions: { type: 'json_schema', name: 'orbit_round', description: 'The journal of this round and the decision for each coin.', strict: true, verbosity: 'medium', schema: { type: 'object', additionalProperties: false, properties: { thesis: { type: 'string' }, reason: { type: 'string' }, mood: { type: 'string' }, coins: { type: 'array', minItems: 10, maxItems: 10, items: { type: 'object', additionalProperties: false, properties: { pair: { type: 'string' }, action: { type: 'string', enum: ['buy', 'sell', 'hold'] }, confidence: { type: 'number' }, line: { type: 'string' }, invalidation: { type: 'string' } }, required: ['pair', 'action', 'confidence', 'line', 'invalidation'] } } }, required: ['thesis', 'reason', 'mood', 'coins'] } } } } }, output: [{ output: '{"thesis":"I am waiting."}' }] } });
const offline = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Model Offline', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: offlineCode }, output: [{ action: 'hold', blockedByRule: 'model_offline' }] } });
const journal = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Read Journal', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: journalCode }, output: [{ parseError: false, calls: [] }] } });
const gate = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Risk Gate', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: gateCode }, output: [{ action: 'hold', placeAny: false, coins: [] }] } });
const place = ifElse({ version: 2.4, config: { name: 'Place Orders?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ leftValue: expr('{{ $json.placeAny }}'), rightValue: true, operator: { type: 'boolean', operation: 'true' } }], combinator: 'and' } }, output: [{ placeAny: false }] } });
const fanOrders = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Fan Orders', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: fanOrdersCode }, output: [{ pair: 'XXBTZEUR', action: 'buy', volume: '15.00' }] } });
const orderLoop = splitInBatches({ version: 3, config: { name: 'Order Lanes', parameters: { batchSize: 1 } } });
const signOrder = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Sign Order', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: signOrderCode }, output: [{ apiSign: 'sign', postData: 'nonce=4' }] } });
const sendOrder = node({ type: 'n8n-nodes-base.httpRequest', version: 4.5, config: { name: 'Send Order', onError: 'continueRegularOutput', parameters: { method: 'POST', url: 'https://api.kraken.com/0/private/AddOrder', ...privateHttp }, output: [{ error: [], result: { txid: ['ORDER-ID'] } }] } });
const record = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Record Fill', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: recordCode }, output: [{ pair: 'XXBTZEUR', rejected: false }] } });
const assemble = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Assemble', executeOnce: true, parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: assembleCode }, output: [{ action: 'hold', coins: [] }] } });
const decision = node({ type: 'n8n-nodes-base.set', version: 3.5, config: { name: 'Decision', executeOnce: true, parameters: { mode: 'raw', jsonOutput: expr('{{ JSON.stringify($json) }}') }, output: [{ action: 'hold', reason: 'I am waiting.' }] } });
const keysNote = sticky('Kraken key and secret live in the data table orbit_kraken. No withdraw. Without that row Orbit reads the public prices and writes wait. A sell only touches volume Orbit bought itself.', [keysPresent], { color: 5 });
const gateNote = sticky('Orbit writes why. The Risk Gate may override that per coin. Plus one percent is a line on this desk, minus 0.5 percent stops a new buy, 15 euro maximum per coin, one position per coin. The list lives on Desk Config.', [gate], { color: 6 });
const publishNote = sticky('Published. Every hour, two minutes past. Manual watch is for a test. The app does not start the round.', [hourly], { color: 4 });

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
  .group('Order', [signOrder, sendOrder, record], { description: 'At most one market order per coin. Small, spot, and only while the gate is open.' });
