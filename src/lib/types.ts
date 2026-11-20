export type OrderFill = {
  type?: string;
  side?: string;
  volume?: string;
  txid?: string;
  descr?: string;
};

export type CoinLane = {
  symbol: string | null;
  pair: string | null;
  action: string | null;
  aiAction: string | null;
  confidence: number | null;
  line: string | null;
  invalidation: string | null;
  setup: string | null;
  side: string | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  sizePct: number | null;
  pnlPct: number | null;
  note: string | null;
  blockedByRule: string | null;
  order: OrderFill | null;
  inPosition: boolean | null;
};

export type Decision = {
  executionId: string;
  startedAt: string | null;
  status: string;
  pair: string | null;
  action: string | null;
  aiAction: string | null;
  reason: string | null;
  thesis: string | null;
  invalidation: string | null;
  mood: string | null;
  confidence: number | null;
  blockedByRule: string | null;
  order: OrderFill | null;
  equityQuote: number | null;
  dayPnlPct: number | null;
  inPosition: boolean | null;
  coins: CoinLane[];
};

export type DeskState = {
  configured: boolean;
  missing: string[];
  published: boolean | null;
  workflowName: string | null;
  workflowId: string | null;
  error: string | null;
  notice?: string | null;
  decisions: Decision[];
};
