export const ruleLabels: Record<string, string> = {
  missing_credentials: "Kraken keys are missing",
  model_offline: "OpenAI did not answer",
  daily_loss: "The loss limit blocked a buy",
  target_reached: "The +1% line is reached",
  already_in_position: "This lane already holds a position",
  already_flat: "There is no position to close",
  max_size: "Free euros do not cover this buy",
  low_conviction: "Conviction stayed under the threshold",
  account_unreadable: "The account could not be read",
  unreadable: "The journal came back unreadable",
  exchange_rejected: "Kraken rejected the order",
};

export function actionLabel(action: string | null): string {
  if (action === "buy") return "Buy";
  if (action === "sell") return "Sell";
  if (action === "hold") return "Wait";
  return "No decision";
}
