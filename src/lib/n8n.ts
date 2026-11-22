import { assignTradeNumbers, deriveDesk } from "./book";
import { defaultFlow, exchangeById, flowById, flows } from "./flows";
import { assignAnalysisNumbers, databaseUrl, listDecisions, listTrades, saveDecision, saveTrades } from "./store";
import type { CoinLane, Decision, DeskState, FlowState, StaticBook, StaticHistory, StaticPending, StaticPosition } from "./types";

type ExecutionRow = {
  id?: string | number;
  status?: string;
  startedAt?: string;
  stoppedAt?: string;
  data?: {
    resultData?: {
      error?: { message?: string };
      runData?: Record<string, Array<{ data?: { main?: Array<Array<{ json?: Record<string, unknown> }>> } }>>;
    };
  };
};

function config() {
  const baseUrl = (process.env.N8N_BASE_URL || "https://vincex34.app.n8n.cloud").replace(/\/$/, "");
  const apiKey = process.env.N8N_API_KEY || "";
  const workflowId = process.env.N8N_WORKFLOW_ID || "";
  const missing: string[] = [];
  if (!apiKey) missing.push("N8N_API_KEY");
  if (!workflowId) missing.push("N8N_WORKFLOW_ID");
  if (!databaseUrl()) missing.push("DATABASE_URL");
  return { baseUrl, apiKey, workflowId, missing };
}

async function n8n(path: string, init?: RequestInit): Promise<Response> {
  const { baseUrl, apiKey } = config();
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function decisionFromRun(execution: ExecutionRow): Record<string, unknown> | null {
  const runs = execution.data?.resultData?.runData?.Decision;
  if (!runs?.length) return null;
  const last = runs[runs.length - 1];
  return last?.data?.main?.[0]?.[0]?.json ?? null;
}

function orderFill(order: Record<string, unknown> | null) {
  if (!order) return null;
  if (!order.txid && !order.volume && !order.side) return null;
  return {
    type: typeof order.type === "string" ? order.type : undefined,
    side: typeof order.side === "string" ? order.side : undefined,
    volume: typeof order.volume === "string" ? order.volume : undefined,
    txid: typeof order.txid === "string" ? order.txid : undefined,
    descr: typeof order.descr === "string" ? order.descr : undefined,
  };
}

function coinsFrom(value: unknown): CoinLane[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    return [
      {
        symbol: typeof row.symbol === "string" ? row.symbol : null,
        pair: typeof row.pair === "string" ? row.pair : null,
        action: typeof row.action === "string" ? row.action : null,
        aiAction: typeof row.aiAction === "string" ? row.aiAction : null,
        confidence: typeof row.confidence === "number" ? row.confidence : null,
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
        order: orderFill(asRecord(row.order)),
        inPosition: typeof row.inPosition === "boolean" ? row.inPosition : null,
      },
    ];
  });
}

function toDecision(execution: ExecutionRow, json: Record<string, unknown> | null, flowId: string): Decision {
  return {
    executionId: String(execution.id ?? ""),
    analysisNo: null,
    flowId,
    startedAt: execution.startedAt ?? null,
    status: execution.status ?? "unknown",
    pair: typeof json?.pair === "string" ? json.pair : null,
    action: typeof json?.action === "string" ? json.action : null,
    aiAction: typeof json?.aiAction === "string" ? json.aiAction : null,
    reason:
      typeof json?.reason === "string"
        ? json.reason
        : execution.data?.resultData?.error?.message || null,
    thesis: typeof json?.thesis === "string" ? json.thesis : null,
    invalidation: typeof json?.invalidation === "string" ? json.invalidation : null,
    mood: typeof json?.mood === "string" ? json.mood : null,
    confidence: typeof json?.confidence === "number" ? json.confidence : null,
    blockedByRule: typeof json?.blockedByRule === "string" ? json.blockedByRule : null,
    order: orderFill(asRecord(json?.order)),
    equityQuote: typeof json?.equityQuote === "number" ? json.equityQuote : null,
    dayPnlPct: typeof json?.dayPnlPct === "number" ? json.dayPnlPct : null,
    inPosition: typeof json?.inPosition === "boolean" ? json.inPosition : null,
    coins: coinsFrom(json?.coins),
  };
}

function textOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function bookFrom(workflow: Record<string, unknown>): StaticBook {
  let data: unknown = workflow.staticData;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = null;
    }
  }
  const globalData = asRecord(asRecord(data)?.global) ?? {};
  const positions: Record<string, StaticPosition> = {};
  for (const [pair, value] of Object.entries(asRecord(globalData.positions) ?? {})) {
    const row = asRecord(value);
    if (!row) continue;
    positions[pair] = {
      side: textOrUndefined(row.side),
      volume: numberOrNull(row.volume) ?? undefined,
      entry: numberOrNull(row.entry) ?? undefined,
      stop: numberOrNull(row.stop) ?? undefined,
      target: numberOrNull(row.target) ?? undefined,
      openedAt: numberOrNull(row.openedAt) ?? undefined,
      txid: textOrUndefined(row.txid),
      setup: textOrUndefined(row.setup),
      setupType: textOrUndefined(row.setupType),
    };
  }
  const pending: Record<string, StaticPending> = {};
  for (const [pair, value] of Object.entries(asRecord(globalData.pending) ?? {})) {
    const row = asRecord(value);
    if (!row) continue;
    pending[pair] = {
      txid: textOrUndefined(row.txid),
      side: textOrUndefined(row.side),
      limit: numberOrNull(row.limit) ?? undefined,
      volume: numberOrNull(row.volume) ?? undefined,
      stop: numberOrNull(row.stop) ?? undefined,
      target: numberOrNull(row.target) ?? undefined,
      placedAt: numberOrNull(row.placedAt) ?? undefined,
      expireAt: numberOrNull(row.expireAt) ?? undefined,
      setup: textOrUndefined(row.setup),
      setupType: textOrUndefined(row.setupType),
      cancelled: row.cancelled === true,
    };
  }
  const history: StaticHistory[] = Array.isArray(globalData.history)
    ? globalData.history.flatMap((item) => {
        const row = asRecord(item);
        if (!row) return [];
        return [
          {
            symbol: textOrUndefined(row.symbol),
            side: textOrUndefined(row.side),
            setupType: textOrUndefined(row.setupType),
            grossPct: numberOrNull(row.grossPct) ?? undefined,
            netPct: numberOrNull(row.netPct) ?? undefined,
            r: numberOrNull(row.r),
            hours: numberOrNull(row.hours) ?? undefined,
            how: textOrUndefined(row.how),
            at: numberOrNull(row.at) ?? undefined,
          },
        ];
      })
    : [];
  return { positions, pending, history };
}

async function syncExecutions(workflowId: string, flowId: string): Promise<string | null> {
  const query = new URLSearchParams({
    workflowId,
    limit: "20",
    includeData: "true",
    redactExecutionData: "false",
  });
  let response = await n8n(`/executions?${query.toString()}`);
  if (response.status === 403) {
    query.delete("redactExecutionData");
    response = await n8n(`/executions?${query.toString()}`);
  }
  if (!response.ok) return `Could not fetch executions (${response.status}).`;
  const body = (await response.json()) as { data?: ExecutionRow[] };
  for (const execution of body.data ?? []) {
    if (!execution.id) continue;
    const json = decisionFromRun(execution);
    const decision = toDecision(execution, json, flowId);
    if (!decision.reason && !decision.action && decision.coins.length === 0 && decision.status === "success") continue;
    await saveDecision(decision, json ?? { status: decision.status, error: decision.reason });
  }
  return null;
}

function publishedFrom(workflow: Record<string, unknown>): boolean {
  if (typeof workflow.active === "boolean") return workflow.active;
  return Boolean(workflow.activeVersionId);
}

function blank(): DeskState {
  const { missing } = config();
  const flowCards: FlowState[] = flows.map((flow) => {
    const exchange = exchangeById(flow.exchangeId);
    return {
      id: flow.id,
      name: flow.name,
      exchangeId: flow.exchangeId,
      exchangeName: exchange?.name || flow.exchangeId,
      quote: exchange?.quote || "USDC",
      engine: flow.engine,
      summary: flow.summary,
      workflowId: (process.env[flow.workflowIdEnv] || "").trim() || null,
      published: null,
      equityQuote: null,
      dayPnlPct: null,
      asOf: null,
    };
  });
  return {
    configured: missing.length === 0,
    missing,
    error: null,
    exchanges: flowCards.map((flow) => ({ id: flow.exchangeId, name: flow.exchangeName, quote: flow.quote })).filter((exchange, index, list) => list.findIndex((item) => item.id === exchange.id) === index),
    flows: flowCards,
    equityQuote: null,
    dayPnlPct: null,
    asOf: null,
    positions: [],
    resting: [],
    analyses: [],
    trades: [],
  };
}

export async function loadDesk(): Promise<DeskState> {
  const state = blank();
  const books = new Map<string, StaticBook | null>();
  if (state.configured) {
    for (const flow of flows) {
      const workflowId = process.env[flow.workflowIdEnv] || "";
      try {
        const workflowResponse = await n8n(`/workflows/${workflowId}`);
        if (!workflowResponse.ok) {
          state.error = `Could not fetch ${flow.name} (${workflowResponse.status}). Check the API key and the workflow id.`;
          books.set(flow.id, null);
          continue;
        }
        const workflow = (await workflowResponse.json()) as Record<string, unknown>;
        const card = state.flows.find((item) => item.id === flow.id);
        if (card) card.published = publishedFrom(workflow);
        books.set(flow.id, bookFrom(workflow));
        const syncError = await syncExecutions(workflowId, flow.id);
        if (syncError) state.error = syncError;
      } catch (error) {
        state.error = error instanceof Error ? error.message : "Unknown error talking to n8n.";
        books.set(flow.id, null);
      }
    }
  }

  try {
    await assignAnalysisNumbers();
    state.analyses = await listDecisions();
  } catch (error) {
    state.error = state.error || (error instanceof Error ? error.message : "Could not read the log.");
  }

  const drafts = [];
  for (const flow of flows) {
    const slice = state.analyses.filter((item) => (item.flowId || defaultFlow().id) === flow.id);
    const derived = deriveDesk({ flow, decisions: slice, book: books.get(flow.id) ?? null });
    drafts.push(...derived.trades);
    state.positions.push(...derived.positions);
    state.resting.push(...derived.resting);
    const card = state.flows.find((item) => item.id === flow.id);
    const withEquity = slice.find((item) => item.equityQuote !== null);
    if (card && withEquity) {
      card.equityQuote = withEquity.equityQuote;
      card.dayPnlPct = withEquity.dayPnlPct;
      card.asOf = withEquity.startedAt;
    }
  }

  let existing: { id: string; tradeNo: number }[] = [];
  try {
    existing = (await listTrades()).map((trade) => ({ id: trade.id, tradeNo: trade.tradeNo }));
  } catch {
    existing = [];
  }
  const trades = assignTradeNumbers(drafts, existing);
  const numbers = new Map(trades.map((trade) => [trade.id, trade.tradeNo]));
  for (const position of state.positions) position.tradeNo = numbers.get(position.tradeId) ?? null;
  try {
    await saveTrades(trades);
  } catch (error) {
    state.error = state.error || (error instanceof Error ? error.message : "Could not save the trade log.");
  }

  state.trades = [...trades].sort((a, b) => b.tradeNo - a.tradeNo);
  const equities = state.flows.map((flow) => flow.equityQuote).filter((value): value is number => value !== null);
  state.equityQuote = equities.length ? equities.reduce((sum, value) => sum + value, 0) : null;
  const newest = [...state.flows].filter((flow) => flow.asOf).sort((a, b) => (b.asOf || "").localeCompare(a.asOf || ""))[0];
  state.dayPnlPct = newest?.dayPnlPct ?? null;
  state.asOf = newest?.asOf ?? state.analyses[0]?.startedAt ?? null;
  return state;
}

export async function setFlowPublished(flowId: string, active: boolean): Promise<DeskState> {
  const flow = flowById(flowId);
  const { missing } = config();
  if (!flow) {
    const state = await loadDesk();
    state.error = "Unknown flow.";
    return state;
  }
  if (missing.length) {
    const state = await loadDesk();
    state.error = "Fill in the missing values in .env.local first.";
    return state;
  }

  const workflowId = process.env[flow.workflowIdEnv] || "";
  const path = active ? "publish" : "unpublish";
  let response = await n8n(`/workflows/${workflowId}/${path}`, { method: "POST", body: "{}" });
  if (response.status === 404 || response.status === 405) {
    const legacy = active ? "activate" : "deactivate";
    response = await n8n(`/workflows/${workflowId}/${legacy}`, { method: "POST", body: "{}" });
  }
  if (!response.ok) {
    const state = await loadDesk();
    state.error = `Could not switch ${flow.name} (${response.status}). The API key needs workflow:activate.`;
    return state;
  }
  return loadDesk();
}

export async function runFlow(flowId: string): Promise<DeskState> {
  const flow = flowById(flowId);
  const { baseUrl, missing } = config();
  const token = flow ? process.env[flow.tokenEnv] || "" : "";
  if (!flow || missing.length || !token) {
    const state = await loadDesk();
    state.error = !flow ? "Unknown flow." : token ? "Fill in the missing values in .env.local first." : `${flow.tokenEnv} is missing.`;
    return state;
  }

  const before = await loadDesk();
  if (before.error) return before;
  const card = before.flows.find((item) => item.id === flow.id);
  if (!card?.published) {
    const switched = await setFlowPublished(flow.id, true);
    if (switched.error) return switched;
  }

  let status = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/webhook/${flow.webhookPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-orbit-token": token },
      body: JSON.stringify({ source: "desk", flowId: flow.id }),
      cache: "no-store",
    });
    status = response.status;
    if (response.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const state = await loadDesk();
  state.error = status >= 200 && status < 300 ? null : `n8n did not take the run (${status}).`;
  state.notice = state.error ? null : "Round started. The page fills in a minute or two.";
  return state;
}
