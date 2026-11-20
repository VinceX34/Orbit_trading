export const ruleLabels: Record<string, string> = {
  missing_credentials: "Kraken keys are missing",
  model_offline: "OpenAI did not answer",
  daily_loss: "The day loss limit blocked a new trade",
  target_reached: "The +1% day line is reached",
  already_in_position: "This coin already holds a position",
  already_flat: "There is no position to close",
  max_positions: "Two positions are already taken",
  max_size: "Free euros do not cover this trade",
  below_minimum: "Below Kraken's minimum order size",
  low_conviction: "Conviction stayed under the threshold",
  invalid_setup: "Stop or target sits on the wrong side",
  stop_too_wide: "Stop is further away than allowed",
  stop_too_tight: "Stop is too close to the price",
  no_edge: "Target does not pay the fees",
  target_hit: "Target reached, the desk closed it",
  stop_missing: "Stop was gone, the desk closed it",
  account_unreadable: "The account could not be read",
  unreadable: "The journal came back unreadable",
  exchange_rejected: "Kraken rejected the order",
};

export function actionLabel(action: string | null): string {
  if (action === "long") return "Long";
  if (action === "short") return "Short";
  if (action === "close") return "Close";
  if (action === "trade") return "Trade";
  if (action === "buy") return "Buy";
  if (action === "sell") return "Sell";
  if (action === "hold") return "Wait";
  return "No decision";
}
