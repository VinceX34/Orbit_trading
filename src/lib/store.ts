import { neon } from "@neondatabase/serverless";
import type { CoinLane, Decision, OrderFill } from "./types";

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
    globalStore.__orbitReady = sql
      .query(
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
      )
      .then(() => undefined);
  }
  await globalStore.__orbitReady;
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
        side: typeof row.side === "string" ? row.side : null,
        entry: numberOrNull(row.entry),
        stop: numberOrNull(row.stop),
        target: numberOrNull(row.target),
        sizePct: numberOrNull(row.sizePct),
        pnlPct: numberOrNull(row.pnlPct),
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
      day_pnl_pct, in_position, raw_json, coins_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
      coins_json = excluded.coins_json`,
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
    ],
  );
}

export async function listDecisions(limit = 40): Promise<Decision[]> {
  if (!databaseUrl()) return [];
  await ready();
  const result = await client().query(
    `SELECT * FROM decisions ORDER BY COALESCE(started_at, execution_id) DESC LIMIT $1`,
    [limit],
  );
  return rowsOf(result).map((row) => ({
    executionId: String(row.execution_id),
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
