import type { CoinLane, Decision, DeskState } from "./types";
import { databaseUrl, listDecisions, saveDecision } from "./store";

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
        blockedByRule: typeof row.blockedByRule === "string" ? row.blockedByRule : null,
        order: orderFill(asRecord(row.order)),
        inPosition: typeof row.inPosition === "boolean" ? row.inPosition : null,
      },
    ];
  });
}

function toDecision(execution: ExecutionRow, json: Record<string, unknown> | null): Decision {
  return {
    executionId: String(execution.id ?? ""),
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

async function syncExecutions(workflowId: string): Promise<string | null> {
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
  if (!response.ok) {
    return `Could not fetch executions (${response.status}).`;
  }
  const body = (await response.json()) as { data?: ExecutionRow[] };
  for (const execution of body.data ?? []) {
    if (!execution.id) continue;
    const json = decisionFromRun(execution);
    const decision = toDecision(execution, json);
    if (!decision.reason && !decision.action && decision.coins.length === 0 && decision.status === "success") continue;
    await saveDecision(decision, json ?? { status: decision.status, error: decision.reason });
  }
  return null;
}

function publishedFrom(workflow: Record<string, unknown>): boolean {
  if (typeof workflow.active === "boolean") return workflow.active;
  return Boolean(workflow.activeVersionId);
}

export async function loadDesk(): Promise<DeskState> {
  const { workflowId, missing } = config();
  const base: DeskState = {
    configured: missing.length === 0,
    missing,
    published: null,
    workflowName: null,
    workflowId: workflowId || null,
    error: null,
    decisions: [],
  };
  if (missing.length) {
    base.decisions = await listDecisions();
    return base;
  }

  try {
    const workflowResponse = await n8n(`/workflows/${workflowId}`);
    if (!workflowResponse.ok) {
      base.error = `Could not fetch the workflow (${workflowResponse.status}). Check the API key and the workflow id.`;
      base.decisions = await listDecisions();
      return base;
    }
    const workflow = (await workflowResponse.json()) as Record<string, unknown>;
    base.published = publishedFrom(workflow);
    base.workflowName = typeof workflow.name === "string" ? workflow.name : null;
    const syncError = await syncExecutions(workflowId);
    base.error = syncError;
    base.decisions = await listDecisions();
    return base;
  } catch (error) {
    base.error = error instanceof Error ? error.message : "Unknown error talking to n8n.";
    base.decisions = await listDecisions();
    return base;
  }
}

export async function setPublished(active: boolean): Promise<DeskState> {
  const { workflowId, missing } = config();
  if (missing.length) {
    const state = await loadDesk();
    state.error = "Fill in the missing values in .env.local first.";
    return state;
  }

  const path = active ? "publish" : "unpublish";
  let response = await n8n(`/workflows/${workflowId}/${path}`, { method: "POST", body: "{}" });
  if (response.status === 404 || response.status === 405) {
    const legacy = active ? "activate" : "deactivate";
    response = await n8n(`/workflows/${workflowId}/${legacy}`, { method: "POST", body: "{}" });
  }
  if (!response.ok) {
    const state = await loadDesk();
    state.error = `Could not switch the workflow (${response.status}). The API key needs workflow:activate.`;
    return state;
  }
  return loadDesk();
}
