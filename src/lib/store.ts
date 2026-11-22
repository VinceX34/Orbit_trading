import { neon } from "@neondatabase/serverless";
import { defaultFlow } from "./flows";
import { parsePositionLimit } from "./flow-limit";
import type { CoinLane, Decision, OrderFill, Trade } from "./types";

type Sql = ReturnType<typeof neon>;
type Row = Record<string, unknown>;

const globalStore = globalThis as typeof globalThis & { __orbitSql?: Sql; __orbitReady?: Promise<void> };

export function databaseUrl(): string {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

function client(): Sql {
  if (globalStore.__orbitSql) return globalStore.__orbitSql;
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is missing.");
  globalStore.__orbitSql = neon(url);
  return globalStore.__orbitSql;
}

function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Row[] }).rows;
  }
  return [];
}

async function ready(): Promise<void> {
  if (!databaseUrl()) return;
  if (!globalStore.__orbitReady) {
    const sql = client();
    globalStore.__orbitReady = (async () => {
      await sql.query(
        `CREATE TABLE IF NOT EXISTS decisions (
          execution_id TEXT PRIMARY KEY,
          started_at TEXT,
          status TEXT NOT NULL,
          pair TEXT,
          action TEXT,
          ai_action TEXT,
          reason TEXT,
          thesis TEXT,
          invalidation TEXT,
          mood TEXT,
          confidence DOUBLE PRECISION,
          blocked_by_rule TEXT,
          order_json TEXT,
          equity_quote DOUBLE PRECISION,
          day_pnl_pct DOUBLE PRECISION,
          in_position BOOLEAN,
          raw_json TEXT,
          coins_json TEXT
        )`,
      );
      await sql.query(`ALTER TABLE decisions ADD COLUMN IF NOT EXISTS analysis_no INTEGER`);
      await sql.query(`ALTER TABLE decisions ADD COLUMN IF NOT EXISTS flow_id TEXT`);
      await sql.query(`UPDATE decisions SET flow_id = $1 WHERE flow_id IS NULL`, [defaultFlow().id]);
      await sql.query(
        `CREATE TABLE IF NOT EXISTS flow_settings (
          flow_id TEXT PRIMARY KEY,
          max_positions INTEGER NOT NULL
        )`,
      );
      await sql.query(
        `CREATE TABLE IF NOT EXISTS trades (
          id TEXT PRIMARY KEY,
          trade_no INTEGER,
          flow_id TEXT NOT NULL,
          exchange_id TEXT NOT NULL,
          symbol TEXT,
          pair TEXT,
          side TEXT,
          status TEXT,
          entry DOUBLE PRECISION,
          exit_price DOUBLE PRECISION,
          stop DOUBLE PRECISION,
          target DOUBLE PRECISION,
          volume DOUBLE PRECISION,
          size_pct DOUBLE PRECISION,
          gross_pct DOUBLE PRECISION,
          net_pct DOUBLE PRECISION,
          r DOUBLE PRECISION,
          hours DOUBLE PRECISION,
          setup_type TEXT,
          thesis TEXT,
          how TEXT,
          opened_at TEXT,
          closed_at TEXT,
          open_analysis_id TEXT,
          close_analysis_id TEXT,
          txid TEXT
        )`,
      );
    })();
  }
  await globalStore.__orbitReady;
}

export async function assignAnalysisNumbers(): Promise<void> {
  if (!databaseUrl()) return;
  await ready();
  await client().query(
    `WITH ranked AS (
      SELECT execution_id, ROW_NUMBER() OVER (ORDER BY COALESCE(started_at, '9999'), execution_id) AS n
      FROM decisions
      WHERE analysis_no IS NULL
    )
    UPDATE decisions AS d
    SET analysis_no = ranked.n + COALESCE((SELECT MAX(analysis_no) FROM decisions WHERE analysis_no IS NOT NULL), 0)
    FROM ranked
    WHERE d.execution_id = ranked.execution_id`,
  );
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function orderFrom(value: unknown): OrderFill | null {
  if (!value || typeof value !== "object") return null;
  const row = value as OrderFill;
  if (!row.txid && !row.volume && !row.side) return null;
  return row;
}

function coinsFrom(value: unknown): CoinLane[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [
      {
        symbol: typeof row.symbol === "string" ? row.symbol : null,
        pair: typeof row.pair === "string" ? row.pair : null,
        action: typeof row.action === "string" ? row.action : null,
        aiAction: typeof row.aiAction === "string" ? row.aiAction : null,
        confidence: numberOrNull(row.confidence),
        line: typeof row.line === "string" ? row.line : null,
        invalidation: typeof row.invalidation === "string" ? row.invalidation : null,
        setup: typeof row.setup === "string" ? row.setup : null,
        setupType: typeof row.setupType === "string" ? row.setupType : null,
        side: typeof row.side === "string" ? row.side : null,
        entry: numberOrNull(row.entry),
        stop: numberOrNull(row.stop),
        target: numberOrNull(row.target),
        sizePct: numberOrNull(row.sizePct),
        pnlPct: numberOrNull(row.pnlPct),
        r: numberOrNull(row.r),
        note: typeof row.note === "string" ? row.note : null,
        blockedByRule: typeof row.blockedByRule === "string" ? row.blockedByRule : null,
        order: orderFrom(row.order),
        inPosition: typeof row.inPosition === "boolean" ? row.inPosition : null,
      },
    ];
  });
}

function held(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  return Number(value) === 1;
}

export async function saveDecision(input: Decision, raw: unknown): Promise<void> {
  await ready();
  await client().query(
    `INSERT INTO decisions (
      execution_id, started_at, status, pair, action, ai_action, reason, thesis,
      invalidation, mood, confidence, blocked_by_rule, order_json, equity_quote,
      day_pnl_pct, in_position, raw_json, coins_json, flow_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (execution_id) DO UPDATE SET
      started_at = excluded.started_at,
      status = excluded.status,
      pair = excluded.pair,
      action = excluded.action,
      ai_action = excluded.ai_action,
      reason = excluded.reason,
      thesis = excluded.thesis,
      invalidation = excluded.invalidation,
      mood = excluded.mood,
      confidence = excluded.confidence,
      blocked_by_rule = excluded.blocked_by_rule,
      order_json = excluded.order_json,
      equity_quote = excluded.equity_quote,
      day_pnl_pct = excluded.day_pnl_pct,
      in_position = excluded.in_position,
      raw_json = excluded.raw_json,
      coins_json = excluded.coins_json,
      flow_id = excluded.flow_id`,
    [
      input.executionId,
      input.startedAt,
      input.status,
      input.pair,
      input.action,
      input.aiAction,
      input.reason,
      input.thesis,
      input.invalidation,
      input.mood,
      input.confidence,
      input.blockedByRule,
      input.order ? JSON.stringify(input.order) : null,
      input.equityQuote,
      input.dayPnlPct,
      input.inPosition,
      JSON.stringify(raw),
      JSON.stringify(input.coins),
      input.flowId || defaultFlow().id,
    ],
  );
}

export async function listDecisions(limit = 200): Promise<Decision[]> {
  if (!databaseUrl()) return [];
  await ready();
  const result = await client().query(
    `SELECT * FROM decisions ORDER BY COALESCE(started_at, execution_id) DESC LIMIT $1`,
    [limit],
  );
  return rowsOf(result).map((row) => ({
    executionId: String(row.execution_id),
    analysisNo: numberOrNull(row.analysis_no),
    flowId: row.flow_id ? String(row.flow_id) : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    status: String(row.status),
    pair: row.pair ? String(row.pair) : null,
    action: row.action ? String(row.action) : null,
    aiAction: row.ai_action ? String(row.ai_action) : null,
    reason: row.reason ? String(row.reason) : null,
    thesis: row.thesis ? String(row.thesis) : null,
    invalidation: row.invalidation ? String(row.invalidation) : null,
    mood: row.mood ? String(row.mood) : null,
    confidence: numberOrNull(row.confidence),
    blockedByRule: row.blocked_by_rule ? String(row.blocked_by_rule) : null,
    order: row.order_json ? orderFrom(JSON.parse(String(row.order_json))) : null,
    equityQuote: numberOrNull(row.equity_quote),
    dayPnlPct: numberOrNull(row.day_pnl_pct),
    inPosition: held(row.in_position),
    coins: row.coins_json ? coinsFrom(JSON.parse(String(row.coins_json))) : [],
  }));
}

function tradeFrom(row: Row): Trade {
  const status = row.status === "open" ? "open" : "closed";
  return {
    id: String(row.id),
    tradeNo: numberOrNull(row.trade_no) || 0,
    flowId: String(row.flow_id || ""),
    exchangeId: String(row.exchange_id || ""),
    symbol: String(row.symbol || ""),
    pair: String(row.pair || ""),
    side: String(row.side || ""),
    status,
    entry: numberOrNull(row.entry),
    exit: numberOrNull(row.exit_price),
    stop: numberOrNull(row.stop),
    target: numberOrNull(row.target),
    volume: numberOrNull(row.volume),
    sizePct: numberOrNull(row.size_pct),
    grossPct: numberOrNull(row.gross_pct),
    netPct: numberOrNull(row.net_pct),
    r: numberOrNull(row.r),
    hours: numberOrNull(row.hours),
    setupType: row.setup_type ? String(row.setup_type) : null,
    thesis: row.thesis ? String(row.thesis) : null,
    how: row.how ? String(row.how) : null,
    openedAt: row.opened_at ? String(row.opened_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    openAnalysisId: row.open_analysis_id ? String(row.open_analysis_id) : null,
    closeAnalysisId: row.close_analysis_id ? String(row.close_analysis_id) : null,
    txid: row.txid ? String(row.txid) : null,
  };
}

async function ensureFlowSettings(): Promise<void> {
  await ready();
  await client().query(
    `CREATE TABLE IF NOT EXISTS flow_settings (
      flow_id TEXT PRIMARY KEY,
      max_positions INTEGER NOT NULL
    )`,
  );
}

export async function flowLimit(flowId: string, fallback: number): Promise<number> {
  if (!databaseUrl()) return fallback;
  await ensureFlowSettings();
  const existing = rowsOf(await client().query(`SELECT max_positions FROM flow_settings WHERE flow_id = $1`, [flowId]))[0];
  const parsed = parsePositionLimit(existing?.max_positions);
  if (parsed !== null) return parsed;
  await client().query(
    `INSERT INTO flow_settings (flow_id, max_positions) VALUES ($1, $2)
     ON CONFLICT (flow_id) DO NOTHING`,
    [flowId, fallback],
  );
  return fallback;
}

export async function saveFlowLimit(flowId: string, maxPositions: number): Promise<void> {
  if (!databaseUrl()) return;
  await ensureFlowSettings();
  await client().query(
    `INSERT INTO flow_settings (flow_id, max_positions) VALUES ($1, $2)
     ON CONFLICT (flow_id) DO UPDATE SET max_positions = excluded.max_positions`,
    [flowId, maxPositions],
  );
}

export async function listTrades(): Promise<Trade[]> {
  if (!databaseUrl()) return [];
  await ready();
  const result = await client().query(`SELECT * FROM trades ORDER BY trade_no ASC`);
  return rowsOf(result).map(tradeFrom);
}

export async function saveTrades(trades: Trade[]): Promise<void> {
  if (!databaseUrl()) return;
  await ready();
  const sql = client();
  const existing = rowsOf(await sql.query(`SELECT id FROM trades`)).map((row) => String(row.id));
  const nextIds = new Set(trades.map((trade) => trade.id));
  for (const id of existing) {
    if (!nextIds.has(id)) await sql.query(`DELETE FROM trades WHERE id = $1`, [id]);
  }
  for (const trade of trades) {
    await sql.query(
      `INSERT INTO trades (
        id, trade_no, flow_id, exchange_id, symbol, pair, side, status, entry, exit_price,
        stop, target, volume, size_pct, gross_pct, net_pct, r, hours, setup_type, thesis,
        how, opened_at, closed_at, open_analysis_id, close_analysis_id, txid
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
      ON CONFLICT (id) DO UPDATE SET
        trade_no = excluded.trade_no,
        flow_id = excluded.flow_id,
        exchange_id = excluded.exchange_id,
        symbol = excluded.symbol,
        pair = excluded.pair,
        side = excluded.side,
        status = excluded.status,
        entry = excluded.entry,
        exit_price = excluded.exit_price,
        stop = excluded.stop,
        target = excluded.target,
        volume = excluded.volume,
        size_pct = excluded.size_pct,
        gross_pct = excluded.gross_pct,
        net_pct = excluded.net_pct,
        r = excluded.r,
        hours = excluded.hours,
        setup_type = excluded.setup_type,
        thesis = excluded.thesis,
        how = excluded.how,
        opened_at = excluded.opened_at,
        closed_at = excluded.closed_at,
        open_analysis_id = excluded.open_analysis_id,
        close_analysis_id = excluded.close_analysis_id,
        txid = excluded.txid`,
      [
        trade.id,
        trade.tradeNo,
        trade.flowId,
        trade.exchangeId,
        trade.symbol,
        trade.pair,
        trade.side,
        trade.status,
        trade.entry,
        trade.exit,
        trade.stop,
        trade.target,
        trade.volume,
        trade.sizePct,
        trade.grossPct,
        trade.netPct,
        trade.r,
        trade.hours,
        trade.setupType,
        trade.thesis,
        trade.how,
        trade.openedAt,
        trade.closedAt,
        trade.openAnalysisId,
        trade.closeAnalysisId,
        trade.txid,
      ],
    );
  }
}
