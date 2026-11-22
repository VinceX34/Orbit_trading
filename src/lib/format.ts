const zone = "Europe/Amsterdam";

export function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatUsdc(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatR(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

export function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const digits = value >= 100 ? 2 : value >= 1 ? 4 : 5;
  return value.toFixed(digits);
}

export function analysisLabel(no: number | null): string {
  if (!no) return "—";
  return `A-${String(no).padStart(3, "0")}`;
}

export function analysisHref(no: number | null, executionId: string): string {
  return `/analysis/${no ?? executionId}`;
}

export function analysisMatches(decision: { executionId: string; analysisNo: number | null }, id: string): boolean {
  if (decision.executionId === id) return true;
  const num = Number(id.trim().replace(/^a-?/i, ""));
  return Number.isFinite(num) && num > 0 && decision.analysisNo === num;
}
