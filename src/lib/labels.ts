export const ruleLabels: Record<string, string> = {
  missing_credentials: "Kraken-sleutels ontbreken",
  model_offline: "OpenAI geeft geen antwoord",
  daily_loss: "De verliesgrens houdt een koop tegen",
  target_reached: "De streep van 1% is gehaald",
  already_in_position: "Deze baan heeft al een eigen stuk",
  already_flat: "Er is geen eigen stuk om te sluiten",
  max_size: "De vrije euro's dekken deze koop niet",
  low_conviction: "De overtuiging bleef onder de drempel",
  account_unreadable: "De rekening was niet leesbaar",
  unreadable: "Het logboek kwam onleesbaar terug",
  exchange_rejected: "Kraken wees de order af",
};

export function actionLabel(action: string | null): string {
  if (action === "buy") return "Koop";
  if (action === "sell") return "Verkoop";
  if (action === "hold") return "Wachten";
  return "Geen besluit";
}
