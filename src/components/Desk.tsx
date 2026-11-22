"use client";

import { useCallback, useEffect, useState } from "react";
import { actionLabel, ruleLabels, setupLabel } from "@/lib/labels";
import type { CoinLane, Decision, DeskState } from "@/lib/types";

function formatWhen(value: string | null): string {
  if (!value) return "no round yet";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatUsdc(value: number | null): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} USDC`;
}

function tone(action: string | null): string {
  if (action === "long" || action === "buy") return "text-mint";
  if (action === "short" || action === "sell") return "text-rose";
  if (action === "close" || action === "manage") return "text-ice";
  return "text-violet";
}

function plan(coin: CoinLane): string | null {
  if (coin.stop === null && coin.target === null) return null;
  const bits: string[] = [];
  if (coin.side) bits.push(coin.side);
  if (coin.entry !== null) bits.push(`entry ${coin.entry}`);
  if (coin.stop !== null) bits.push(`stop ${coin.stop}`);
  if (coin.target !== null) bits.push(`target ${coin.target}`);
  if (coin.sizePct !== null) bits.push(`${coin.sizePct}% of desk`);
  if (coin.pnlPct !== null) bits.push(`now ${formatPct(coin.pnlPct)}`);
  if (coin.r !== null) bits.push(`${coin.r > 0 ? "+" : ""}${coin.r.toFixed(2)}R`);
  return bits.join(" · ");
}

function Lane({ coin }: { coin: CoinLane }) {
  return (
    <li className="grid gap-2 border-t border-[var(--line)] py-4 sm:grid-cols-[88px_110px_1fr]">
      <p className="font-mono text-sm tracking-[0.14em] text-paper">{coin.symbol || coin.pair || "—"}</p>
      <p className={`font-mono text-xs uppercase tracking-[0.16em] ${tone(coin.action)}`}>{actionLabel(coin.action)}</p>
      <div>
        {coin.line ? <p className="text-sm leading-6 text-paper-dim">{coin.line}</p> : null}
        {coin.setup ? <p className="mt-2 text-sm leading-6 text-paper">{coin.setup}</p> : null}
        {plan(coin) ? <p className="mt-2 font-mono text-[11px] tracking-[0.08em] text-ice">{plan(coin)}</p> : null}
        {coin.note ? <p className="mt-2 text-sm leading-6 text-violet">{coin.note}</p> : null}
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-dim">
          {coin.confidence === null ? "—" : coin.confidence.toFixed(2)}
          {coin.setupType ? ` · ${setupLabel(coin.setupType)}` : ""}
          {coin.blockedByRule ? ` · ${ruleLabels[coin.blockedByRule] || coin.blockedByRule}` : ""}
          {coin.inPosition ? " · held" : ""}
          {coin.order?.txid ? ` · ${coin.order.txid}` : ""}
        </p>
      </div>
    </li>
  );
}

function Entry({ decision }: { decision: Decision }) {
  return (
    <article className="border-t border-[var(--line)] py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ice">{formatWhen(decision.startedAt)}</p>
        <p className="font-mono text-xs text-paper-dim">{decision.mood || "—"}</p>
      </div>
      {decision.thesis ? <h3 className="mt-3 text-2xl leading-snug">{decision.thesis}</h3> : null}
      {decision.reason ? <p className="mt-3 max-w-3xl whitespace-pre-wrap text-[17px] leading-8 text-paper-dim">{decision.reason}</p> : null}
      {decision.blockedByRule ? (
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-violet">
          {ruleLabels[decision.blockedByRule] || decision.blockedByRule}
        </p>
      ) : null}
      {decision.coins.length ? (
        <ul className="mt-6">
          {decision.coins.map((coin) => (
            <Lane key={`${decision.executionId}-${coin.pair || coin.symbol}`} coin={coin} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function Desk({ view }: { view: "desk" | "log" }) {
  const [state, setState] = useState<DeskState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/desk", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    setState((await response.json()) as DeskState);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    const poll = window.setInterval(() => {
      void refresh();
    }, 20000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [refresh]);

  async function toggle() {
    if (!state?.configured || busy) return;
    setBusy(true);
    const response = await fetch("/api/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !state.published }),
    });
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    setState((await response.json()) as DeskState);
    setBusy(false);
  }

  async function run() {
    if (!state?.configured || busy) return;
    setBusy(true);
    const response = await fetch("/api/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run: true }),
    });
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    setState((await response.json()) as DeskState);
    setBusy(false);
  }

  const latest = state?.decisions[0];
  const on = Boolean(state?.published);

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="h-fit rounded-3xl border border-[var(--line)] bg-ink-2/80 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper-dim">The switch</p>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={!state?.configured || busy}
          className="mt-4 flex w-full items-center justify-between rounded-full border border-[var(--line)] bg-ink px-2 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={`rounded-full px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] ${on ? "bg-ice text-ink" : "text-paper-dim"}`}>
            {on ? "On" : "Off"}
          </span>
          <span className="pr-4 font-mono text-xs uppercase tracking-[0.16em] text-violet">{busy ? "wait" : on ? "published" : "quiet"}</span>
        </button>
        <button
          type="button"
          onClick={() => void run()}
          disabled={!state?.configured || busy}
          className="mt-3 w-full rounded-full border border-[var(--line)] px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-ice hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "wait" : "Run now"}
        </button>
        {state?.notice ? <p className="mt-3 text-sm leading-6 text-ice">{state.notice}</p> : null}
        <p className="mt-4 text-sm leading-6 text-paper-dim">
          Run now switches Orbit on and starts a round right away. {state?.workflowName || "Orbit"}. Off means n8n will not start the next round. A round already running still finishes its hour.
        </p>
        {state && !state.configured ? (
          <p className="mt-4 text-sm leading-6 text-ice">Missing in .env.local: {state.missing.join(", ")}.</p>
        ) : null}
        {state?.error ? <p className="mt-4 text-sm leading-6 text-rose">{state.error}</p> : null}
        <div className="mt-6 border-t border-[var(--line)] pt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper-dim">Desk</p>
          <p className="mt-2 font-mono text-2xl text-paper">{formatUsdc(latest?.equityQuote ?? null)}</p>
          <p className="mt-2 font-mono text-xs text-paper-dim">Today {formatPct(latest?.dayPnlPct ?? null)}</p>
        </div>
      </aside>

      <section>
        {view === "desk" ? (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ice">Latest round</p>
            {latest ? (
              <Entry decision={latest} />
            ) : (
              <p className="mt-4 max-w-xl text-lg leading-8 text-paper-dim">
                No round yet. Once Orbit has walked the ten coins, the note and each coin land here.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ice">All rounds</p>
            {state?.decisions.length ? (
              state.decisions.map((decision) => <Entry key={decision.executionId} decision={decision} />)
            ) : (
              <p className="mt-4 text-lg leading-8 text-paper-dim">No pages yet.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
