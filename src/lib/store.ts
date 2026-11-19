import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CoinLane, Decision, OrderFill } from "./types";

type Store = { db: DatabaseSync };

const globalStore = globalThis as typeof globalThis & { __orbit?: Store };

function database(): DatabaseSync {
  if (globalStore.__orbit) return globalStore.__orbit.db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "desk.sqlite"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
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
      confidence REAL,
      blocked_by_rule TEXT,
      order_json TEXT,
      equity_quote REAL,
      day_pnl_pct REAL,
      in_position INTEGER,
      raw_json TEXT,
      coins_json TEXT
    )
  `);
  const columns = db.prepare("PRAGMA table_info(decisions)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "coins_json")) {
    db.exec("ALTER TABLE decisions ADD COLUMN coins_json TEXT");
  }
  globalStore.__orbit = { db };
  return db;
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
        blockedByRule: typeof row.blockedByRule === "string" ? row.blockedByRule : null,
        order: orderFrom(row.order),
        inPosition: typeof row.inPosition === "boolean" ? row.inPosition : null,
      },
    ];
  });
}

export function saveDecision(input: Decision, raw: unknown): void {
  database()
    .prepare(
      `INSERT INTO decisions (
        execution_id, started_at, status, pair, action, ai_action, reason, thesis,
        invalidation, mood, confidence, blocked_by_rule, order_json, equity_quote,
        day_pnl_pct, in_position, raw_json, coins_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(execution_id) DO UPDATE SET
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
    )
    .run(
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
      input.inPosition === null ? null : input.inPosition ? 1 : 0,
      JSON.stringify(raw),
      JSON.stringify(input.coins),
    );
}

export function listDecisions(limit = 40): Decision[] {
  const rows = database()
    .prepare(`SELECT * FROM decisions ORDER BY COALESCE(started_at, execution_id) DESC LIMIT ?`)
    .all(limit);

  return rows.map((row) => ({
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
    inPosition: row.in_position === null || row.in_position === undefined ? null : Number(row.in_position) === 1,
    coins: row.coins_json ? coinsFrom(JSON.parse(String(row.coins_json))) : [],
  }));
}
