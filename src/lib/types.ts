export type StaticPosition = {
  side?: string;
  volume?: number;
  entry?: number;
  stop?: number;
  target?: number;
  openedAt?: number;
  txid?: string;
  setup?: string;
  setupType?: string;
};

export type StaticPending = {
  txid?: string;
  side?: string;
  limit?: number;
  volume?: number;
  stop?: number;
  target?: number;
  placedAt?: number;
  expireAt?: number;
  setup?: string;
  setupType?: string;
  cancelled?: boolean;
};

export type StaticHistory = {
  symbol?: string;
  side?: string;
  setupType?: string;
  grossPct?: number;
  netPct?: number;
  r?: number | null;
  hours?: number;
  how?: string;
  at?: number;
};

export type StaticBook = {
  positions: Record<string, StaticPosition>;
  pending: Record<string, StaticPending>;
  history: StaticHistory[];
};

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
  setupType: string | null;
  side: string | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  sizePct: number | null;
  pnlPct: number | null;
  r: number | null;
  note: string | null;
  blockedByRule: string | null;
  order: OrderFill | null;
  inPosition: boolean | null;
};

export type Decision = {
  executionId: string;
  analysisNo: number | null;
  flowId: string | null;
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

export type Trade = {
  id: string;
  tradeNo: number;
  flowId: string;
  exchangeId: string;
  symbol: string;
  pair: string;
  side: string;
  status: "open" | "closed";
  entry: number | null;
  exit: number | null;
  stop: number | null;
  target: number | null;
  volume: number | null;
  sizePct: number | null;
  grossPct: number | null;
  netPct: number | null;
  r: number | null;
  hours: number | null;
  setupType: string | null;
  thesis: string | null;
  how: string | null;
  openedAt: string | null;
  closedAt: string | null;
  openAnalysisId: string | null;
  closeAnalysisId: string | null;
  txid: string | null;
};

export type TradeDraft = Omit<Trade, "tradeNo">;

export type PositionView = {
  tradeId: string;
  tradeNo: number | null;
  flowId: string;
  exchangeId: string;
  symbol: string;
  pair: string;
  side: string;
  volume: number | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  pnlPct: number | null;
  r: number | null;
  sizePct: number | null;
  setupType: string | null;
  thesis: string | null;
  line: string | null;
  openedAt: string | null;
  analysisId: string | null;
};

export type RestingOrder = {
  flowId: string;
  exchangeId: string;
  symbol: string;
  pair: string;
  side: string;
  limit: number | null;
  stop: number | null;
  target: number | null;
  volume: number | null;
  placedAt: string | null;
  expiresAt: string | null;
  analysisId: string | null;
  txid: string | null;
};

export type FlowState = {
  id: string;
  name: string;
  exchangeId: string;
  exchangeName: string;
  quote: string;
  engine: "n8n";
  summary: string;
  workflowId: string | null;
  published: boolean | null;
  equityQuote: number | null;
  dayPnlPct: number | null;
  asOf: string | null;
};

export type ExchangeState = {
  id: string;
  name: string;
  quote: string;
};

export type DeskState = {
  configured: boolean;
  missing: string[];
  error: string | null;
  notice?: string | null;
  exchanges: ExchangeState[];
  flows: FlowState[];
  equityQuote: number | null;
  dayPnlPct: number | null;
  asOf: string | null;
  positions: PositionView[];
  resting: RestingOrder[];
  analyses: Decision[];
  trades: Trade[];
};
