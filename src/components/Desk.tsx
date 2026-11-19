"use client";

import { useCallback, useEffect, useState } from "react";
import { actionLabel, ruleLabels } from "@/lib/labels";
import type { CoinLane, Decision, DeskState } from "@/lib/types";

function formatWhen(value: string | null): string {
  if (!value) return "nog geen ronde";
  return new Intl.DateTimeFormat("nl-NL", {
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

function formatEur(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function tone(action: string | null): string {
  if (action === "buy") return "text-mint";
  if (action === "sell") return "text-rose";
  return "text-violet";
}

function Tide({ pct }: { pct: number | null }) {
  const min = -0.5;
  const max = 1;
  const clamped = pct === null ? null : Math.min(max, Math.max(min, pct));
  const position = clamped === null ? 50 : ((clamped - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-paper-dim">
        <span>−0,5%</span>
        <span>de streep +1%</span>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-ink">
        <div className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--rose),var(--violet),var(--ice))]" style={{ width: "100%" }} />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-ink bg-paper"
          style={{ left: `calc(${position}% - 8px)` }}
        />
      </div>
      <p className="mt-3 font-mono text-2xl text-paper">{formatPct(pct)}</p>
    </div>
  );
}

function Lane({ coin }: { coin: CoinLane }) {
  return (
    <li className="grid gap-2 border-t border-[var(--line)] py-4 sm:grid-cols-[88px_110px_1fr]">
      <p className="font-mono text-sm tracking-[0.14em] text-paper">{coin.symbol || coin.pair || "—"}</p>
      <p className={`font-mono text-xs uppercase tracking-[0.16em] ${tone(coin.action)}`}>{actionLabel(coin.action)}</p>
      <div>
        {coin.line ? <p className="text-sm leading-6 text-paper-dim">{coin.line}</p> : null}
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-paper-dim">
          {coin.confidence === null ? "—" : coin.confidence.toFixed(2)}
          {coin.blockedByRule ? ` · ${ruleLabels[coin.blockedByRule] || coin.blockedByRule}` : ""}
          {coin.inPosition ? " · eigen stuk" : ""}
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

export function Desk({ view }: { view: "bureau" | "logboek" }) {
  const [state, setState] = useState<DeskState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/desk", { cache: "no-store" });
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
    setState((await response.json()) as DeskState);
    setBusy(false);
  }

  const latest = state?.decisions[0];
  const on = Boolean(state?.published);

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="h-fit rounded-3xl border border-[var(--line)] bg-ink-2/80 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper-dim">De schakelaar</p>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={!state?.configured || busy}
          className="mt-4 flex w-full items-center justify-between rounded-full border border-[var(--line)] bg-ink px-2 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={`rounded-full px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] ${on ? "bg-ice text-ink" : "text-paper-dim"}`}>
            {on ? "Aan" : "Uit"}
          </span>
          <span className="pr-4 font-mono text-xs uppercase tracking-[0.16em] text-violet">{busy ? "wacht" : on ? "gepubliceerd" : "stil"}</span>
        </button>
        <p className="mt-4 text-sm leading-6 text-paper-dim">
          {state?.workflowName || "Orbit"}. Uit betekent dat n8n de ronde niet meer start. Een ronde die al bezig is maakt zijn uur nog af.
        </p>
        {state && !state.configured ? (
          <p className="mt-4 text-sm leading-6 text-ice">Ontbreekt in .env.local: {state.missing.join(", ")}.</p>
        ) : null}
        {state?.error ? <p className="mt-4 text-sm leading-6 text-rose">{state.error}</p> : null}
        <div className="mt-6">
          <Tide pct={latest?.dayPnlPct ?? null} />
          <p className="mt-2 font-mono text-xs text-paper-dim">Bureau {formatEur(latest?.equityQuote ?? null)}</p>
        </div>
      </aside>

      <section>
        {view === "bureau" ? (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ice">Laatste ronde</p>
            {latest ? (
              <Entry decision={latest} />
            ) : (
              <p className="mt-4 max-w-xl text-lg leading-8 text-paper-dim">
                Nog geen ronde. Zodra Orbit een baan heeft gemaakt, staat hier het logboek en de tien coins.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ice">Alle rondes</p>
            {state?.decisions.length ? (
              state.decisions.map((decision) => <Entry key={decision.executionId} decision={decision} />)
            ) : (
              <p className="mt-4 text-lg leading-8 text-paper-dim">Nog geen bladzijden.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
