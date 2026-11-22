export const ruleLabels: Record<string, string> = {
  missing_credentials: "Kraken keys are missing",
  model_offline: "OpenAI did not answer",
  daily_loss: "The day loss limit blocked a new trade",
  target_reached: "The +1% day line is reached",
  already_in_position: "This coin already holds a position",
  already_flat: "There is no position to close",
  order_pending: "A limit order is already resting here",
  max_positions: "Two positions are already taken",
  max_size: "Free USDC does not cover this trade",
  no_short: "This pair cannot be shorted, long only",
  below_minimum: "Below Kraken's minimum order size",
  low_conviction: "Conviction stayed under the threshold",
  invalid_setup: "Entry, stop or target does not add up",
  stop_too_wide: "Stop is further away than the coin's range allows",
  stop_too_tight: "Stop sits inside the normal noise",
  stop_too_close: "The new stop was too close to the price",
  weak_reward: "The target does not pay enough after fees",
  no_edge: "Target does not pay the fees",
  entry_too_far: "The entry is too far from the price",
  overextended: "Price has already run too far",
  cooldown: "Just lost on this side here, waiting",
  target_hit: "Target reached, the desk closed it",
  trail_exit: "Fell back to the protective stop, the desk closed it",
  time_stop: "Went nowhere for three days, the desk closed it",
  stop_missing: "Stop was gone, the desk closed it",
  account_unreadable: "The account could not be read",
  unreadable: "The journal came back unreadable",
  exchange_rejected: "Kraken rejected the order",
};

const setupLabels: Record<string, string> = {
  trend_pullback: "trend pullback",
  breakout: "breakout",
  range_fade: "range fade",
  exhaustion_reversal: "exhaustion reversal",
  other: "own setup",
};

export function setupLabel(setupType: string): string {
  return setupLabels[setupType] || setupType;
}

export function actionLabel(action: string | null): string {
  if (action === "long") return "Long";
  if (action === "short") return "Short";
  if (action === "close") return "Close";
  if (action === "manage") return "Manage";
  if (action === "trade") return "Trade";
  if (action === "buy") return "Buy";
  if (action === "sell") return "Sell";
  if (action === "hold") return "Wait";
  return "No decision";
}
