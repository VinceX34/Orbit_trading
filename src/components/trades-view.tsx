"use client";

import Link from "next/link";
import { useDesk } from "@/components/desk-provider";
import { Empty, PageTitle, sideClass } from "@/components/ui";
import { analysisHref, analysisLabel, formatPct, formatPrice, formatR, formatWhen } from "@/lib/format";
import type { Decision } from "@/lib/types";

function analysisOf(analyses: Decision[], id: string | null) {
  if (!id) return null;
  return analyses.find((item) => item.executionId === id) ?? null;
}

export function TradesPage() {
  const { state } = useDesk();
  if (!state) return <p className="text-sm text-muted">Loading the desk…</p>;
  return (
    <>
      <PageTitle title="Trade log" lede="Each fill gets a number. The analysis id is the round that opened it, and the round that closed it when there is one." />
      {state.trades.length === 0 ? (
        <Empty>No trades yet.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-elev">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-normal">#</th>
                <th className="px-3 py-2 font-normal">Opened</th>
                <th className="px-3 py-2 font-normal">Coin</th>
                <th className="px-3 py-2 font-normal">Side</th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-3 py-2 font-normal">Entry</th>
                <th className="px-3 py-2 font-normal">Exit</th>
                <th className="px-3 py-2 font-normal">Net</th>
                <th className="px-3 py-2 font-normal">R</th>
                <th className="px-3 py-2 font-normal">How</th>
                <th className="px-3 py-2 font-normal">Analysis</th>
              </tr>
            </thead>
            <tbody>
              {state.trades.map((trade) => {
                const opened = analysisOf(state.analyses, trade.openAnalysisId);
                const closed = analysisOf(state.analyses, trade.closeAnalysisId);
                return (
                  <tr key={trade.id} className="border-t border-line">
                    <td className="px-3 py-2 font-mono text-xs">#{trade.tradeNo}</td>
                    <td className="px-3 py-2 text-xs text-muted">{formatWhen(trade.openedAt)}</td>
                    <td className="px-3 py-2">{trade.symbol}</td>
                    <td className={`px-3 py-2 capitalize ${sideClass(trade.side)}`}>{trade.side}</td>
                    <td className="px-3 py-2 capitalize">{trade.status}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatPrice(trade.entry)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatPrice(trade.exit)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatPct(trade.netPct)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatR(trade.r)}</td>
                    <td className="px-3 py-2 text-xs text-muted">{trade.how || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {opened ? (
                        <Link href={analysisHref(opened.analysisNo, opened.executionId)} className="text-accent hover:underline">
                          {analysisLabel(opened.analysisNo)}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {closed && closed.executionId !== opened?.executionId ? (
                        <>
                          {" → "}
                          <Link href={analysisHref(closed.analysisNo, closed.executionId)} className="text-accent hover:underline">
                            {analysisLabel(closed.analysisNo)}
                          </Link>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
