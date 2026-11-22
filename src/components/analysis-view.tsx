"use client";

import Link from "next/link";
import { useDesk } from "@/components/desk-provider";
import { Empty, PageTitle, sideClass } from "@/components/ui";
import { analysisHref, analysisLabel, analysisMatches, formatPct, formatPrice, formatR, formatWhen } from "@/lib/format";
import { actionLabel, ruleLabels, setupLabel } from "@/lib/labels";
import type { CoinLane, Decision, Trade } from "@/lib/types";

function tone(action: string | null): string {
  if (action === "long" || action === "buy") return "text-up";
  if (action === "short" || action === "sell") return "text-down";
  if (action === "close" || action === "manage") return "text-accent";
  return "text-muted";
}

function plan(coin: CoinLane): string | null {
  if (coin.stop === null && coin.target === null && coin.entry === null) return null;
  const bits: string[] = [];
  if (coin.side) bits.push(coin.side);
  if (coin.entry !== null) bits.push(`entry ${formatPrice(coin.entry)}`);
  if (coin.stop !== null) bits.push(`stop ${formatPrice(coin.stop)}`);
  if (coin.target !== null) bits.push(`target ${formatPrice(coin.target)}`);
  if (coin.sizePct !== null) bits.push(`${coin.sizePct}% of desk`);
  if (coin.pnlPct !== null) bits.push(formatPct(coin.pnlPct));
  if (coin.r !== null) bits.push(formatR(coin.r));
  return bits.join(" · ");
}

export function AnalysisList() {
  const { state } = useDesk();
  if (!state) return <p className="text-sm text-muted">Loading the desk…</p>;
  return (
    <>
      <PageTitle title="Analysis" lede="Every round gets an id. Trades that open or close in that round link back here." />
      {state.analyses.length === 0 ? (
        <Empty>No round yet. A flow writes an analysis each hour it is on.</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-elev">
          {state.analyses.map((decision) => (
            <li key={decision.executionId}>
              <Link href={analysisHref(decision.analysisNo, decision.executionId)} className="block px-4 py-3 hover:bg-sunken">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs text-accent">{analysisLabel(decision.analysisNo)}</p>
                  <p className="text-xs text-muted">{formatWhen(decision.startedAt)}</p>
                </div>
                <p className="mt-1 text-sm">{decision.thesis || "No thesis."}</p>
                <p className="mt-1 text-xs text-muted">{decision.mood || "—"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TradeLinks({ trades }: { trades: Trade[] }) {
  if (!trades.length) return null;
  return (
    <p className="mt-3 text-sm text-muted">
      Trades{" "}
      {trades.map((trade, index) => (
        <span key={trade.id}>
          {index > 0 ? ", " : ""}
          <Link href="/trades" className="font-mono text-accent hover:underline">
            #{trade.tradeNo}
          </Link>
        </span>
      ))}
    </p>
  );
}

function CoinBlock({ coin }: { coin: CoinLane }) {
  return (
    <li className="border-t border-line py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{coin.symbol || coin.pair}</p>
        <p className={`font-mono text-xs uppercase ${tone(coin.action)}`}>{actionLabel(coin.action)}</p>
      </div>
      {coin.line ? <p className="mt-1 text-sm leading-6 text-muted">{coin.line}</p> : null}
      {coin.setup ? <p className="mt-1 text-sm leading-6">{coin.setup}</p> : null}
      {plan(coin) ? <p className={`mt-1 font-mono text-xs ${sideClass(coin.side)}`}>{plan(coin)}</p> : null}
      {coin.note ? <p className="mt-1 text-sm leading-6 text-muted">{coin.note}</p> : null}
      <p className="mt-1 text-xs text-muted">
        {coin.confidence === null ? "—" : coin.confidence.toFixed(2)}
        {coin.setupType ? ` · ${setupLabel(coin.setupType)}` : ""}
        {coin.blockedByRule ? ` · ${ruleLabels[coin.blockedByRule] || coin.blockedByRule}` : ""}
      </p>
    </li>
  );
}

export function AnalysisBody({ decision, trades }: { decision: Decision; trades: Trade[] }) {
  const linked = trades.filter((trade) => trade.openAnalysisId === decision.executionId || trade.closeAnalysisId === decision.executionId);
  return (
    <article>
      <p className="font-mono text-xs text-accent">{analysisLabel(decision.analysisNo)}</p>
      <h1 className="mt-1 text-lg font-medium tracking-tight">{decision.thesis || "No thesis."}</h1>
      <p className="mt-1 text-xs text-muted">
        {formatWhen(decision.startedAt)}
        {decision.mood ? ` · ${decision.mood}` : ""}
        {decision.equityQuote !== null ? ` · ${decision.equityQuote.toFixed(2)} USDC` : ""}
      </p>
      <TradeLinks trades={linked} />
      {decision.reason ? <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted">{decision.reason}</p> : null}
      {decision.blockedByRule ? <p className="mt-3 text-xs text-muted">{ruleLabels[decision.blockedByRule] || decision.blockedByRule}</p> : null}
      {decision.coins.length ? (
        <ul className="mt-4">
          {decision.coins.map((coin) => (
            <CoinBlock key={`${decision.executionId}-${coin.pair || coin.symbol}`} coin={coin} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function AnalysisDetail({ id }: { id: string }) {
  const { state } = useDesk();
  if (!state) return <p className="text-sm text-muted">Loading the desk…</p>;
  const decision = state.analyses.find((item) => analysisMatches(item, id));
  if (!decision) {
    return (
      <>
        <PageTitle title="Analysis" />
        <Empty>That round is not in the log.</Empty>
      </>
    );
  }
  return (
    <>
      <Link href="/analysis" className="mb-4 inline-block text-xs text-muted hover:text-text">
        All analyses
      </Link>
      <div className="rounded-lg border border-line bg-elev p-4">
        <AnalysisBody decision={decision} trades={state.trades} />
      </div>
    </>
  );
}

export function LatestAnalysis() {
  const { state } = useDesk();
  const decision = state?.analyses[0];
  if (!decision) return <Empty>No round yet.</Empty>;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <Link href={analysisHref(decision.analysisNo, decision.executionId)} className="font-mono text-xs text-accent hover:underline">
          {analysisLabel(decision.analysisNo)}
        </Link>
        <p className="text-xs text-muted">{formatWhen(decision.startedAt)}</p>
      </div>
      <p className="mt-2 text-sm leading-6">{decision.thesis || "No thesis."}</p>
      <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted">{decision.reason}</p>
    </div>
  );
}
