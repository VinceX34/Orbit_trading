export type Exchange = {
  id: string;
  name: string;
  quote: string;
};

export type TradeFlow = {
  id: string;
  name: string;
  exchangeId: string;
  engine: "n8n";
  workflowIdEnv: "N8N_WORKFLOW_ID";
  webhookPath: string;
  tokenEnv: "ORBIT_RUN_TOKEN";
  summary: string;
  maxPositions: number;
};

export const exchanges: Exchange[] = [{ id: "kraken", name: "Kraken", quote: "USDC" }];

export const flows: TradeFlow[] = [
  {
    id: "orbit-kraken",
    name: "Orbit",
    exchangeId: "kraken",
    engine: "n8n",
    workflowIdEnv: "N8N_WORKFLOW_ID",
    webhookPath: "orbit-run-now",
    tokenEnv: "ORBIT_RUN_TOKEN",
    summary: "Hourly book review and hunt on ten USDC pairs.",
    maxPositions: 3,
  },
];

export const pairSymbol: Record<string, string> = {
  XBTUSDC: "BTC",
  ETHUSDC: "ETH",
  SOLUSDC: "SOL",
  XRPUSDC: "XRP",
  ADAUSDC: "ADA",
  XDGUSDC: "DOGE",
  LINKUSDC: "LINK",
  AVAXUSDC: "AVAX",
  DOTUSDC: "DOT",
  LTCUSDC: "LTC",
};

export function flowById(id: string): TradeFlow | undefined {
  return flows.find((flow) => flow.id === id);
}

export function exchangeById(id: string): Exchange | undefined {
  return exchanges.find((exchange) => exchange.id === id);
}

export function defaultFlow(): TradeFlow {
  const flow = flows[0];
  if (!flow) throw new Error("No trade flow is registered.");
  return flow;
}
