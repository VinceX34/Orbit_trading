"use client";

import Link from "next/link";
import { useDesk } from "@/components/desk-provider";
import { Empty, PageTitle, sideClass } from "@/components/ui";
import { analysisHref, analysisLabel, formatPct, formatPrice, formatR, formatWhen } from "@/lib/format";
import { setupLabel } from "@/lib/labels";
import type { Decision, PositionView, RestingOrder } from "@/lib/types";

function analysisOf(analyses: Decision[], id: string | null) {
  if (!id) return null;
  return analyses.find((item) => item.executionId === id) ?? null;
}

export function PositionTable({ positions, analyses, compact }: { positions: PositionView[]; analyses: Decision[]; compact?: boolean }) {
  const rows = compact ? positions.slice(0, 4) : positions;
  if (!rows.length) return <Empty>No open positions.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1 pr-3 font-normal">Trade</th>
            <th className="py-1 pr-3 font-normal">Coin</th>
            <th className="py-1 pr-3 font-normal">Side</th>
            <th className="py-1 pr-3 font-normal">Entry</th>
            <th className="py-1 pr-3 font-normal">Stop</th>
            <th className="py-1 pr-3 font-normal">Target</th>
            <th className="py-1 pr-3 font-normal">Now</th>
            <th className="py-1 font-normal">Analysis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((position) => {
            const analysis = analysisOf(analyses, position.analysisId);
            return (
              <tr key={position.tradeId} className="border-t border-line">
                <td className="py-2 pr-3 font-mono text-xs">{position.tradeNo ? `#${position.tradeNo}` : "—"}</td>
                <td className="py-2 pr-3">{position.symbol}</td>
                <td className={`py-2 pr-3 capitalize ${sideClass(position.side)}`}>{position.side}</td>
                <td className="py-2 pr-3 font-mono text-xs">{formatPrice(position.entry)}</td>
                <td className="py-2 pr-3 font-mono text-xs">{formatPrice(position.stop)}</td>
                <td className="py-2 pr-3 font-mono text-xs">{formatPrice(position.target)}</td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {formatPct(position.pnlPct)} · {formatR(position.r)}
                </td>
                <td className="py-2 font-mono text-xs">
                  {analysis ? (
                    <Link href={analysisHref(analysis.analysisNo, analysis.executionId)} className="text-accent hover:underline">
                      {analysisLabel(analysis.analysisNo)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RestingTable({ orders, analyses }: { orders: RestingOrder[]; analyses: Decision[] }) {
  if (!orders.length) return null;
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-medium">Resting orders</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pr-3 font-normal">Coin</th>
              <th className="py-1 pr-3 font-normal">Side</th>
              <th className="py-1 pr-3 font-normal">Limit</th>
              <th className="py-1 pr-3 font-normal">Stop</th>
              <th className="py-1 pr-3 font-normal">Expires</th>
              <th className="py-1 font-normal">Analysis</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const analysis = analysisOf(analyses, order.analysisId);
              return (
                <tr key={`${order.pair}-${order.txid || order.limit}`} className="border-t border-line">
                  <td className="py-2 pr-3">{order.symbol}</td>
                  <td className={`py-2 pr-3 capitalize ${sideClass(order.side)}`}>{order.side}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{formatPrice(order.limit)}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{formatPrice(order.stop)}</td>
                  <td className="py-2 pr-3 text-xs text-muted">{formatWhen(order.expiresAt)}</td>
                  <td className="py-2 font-mono text-xs">
                    {analysis ? (
                      <Link href={analysisHref(analysis.analysisNo, analysis.executionId)} className="text-accent hover:underline">
                        {analysisLabel(analysis.analysisNo)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PositionsPage() {
  const { state } = useDesk();
  if (!state) return <p className="text-sm text-muted">Loading the desk…</p>;
  return (
    <>
      <PageTitle title="Open positions" lede="What the flows are holding right now, with the analysis that opened each one." />
      <div className="space-y-4">
        {state.positions.map((position) => (
          <article key={position.tradeId} className="rounded-lg border border-line bg-elev p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">
                {position.symbol} <span className={`capitalize ${sideClass(position.side)}`}>{position.side}</span>
              </h2>
              <p className="font-mono text-xs text-muted">
                {position.tradeNo ? `#${position.tradeNo}` : "New"}
                {position.setupType ? ` · ${setupLabel(position.setupType)}` : ""}
                {position.openedAt ? ` · ${formatWhen(position.openedAt)}` : ""}
              </p>
            </div>
            <p className="mt-2 font-mono text-xs text-muted">
              Entry {formatPrice(position.entry)} · stop {formatPrice(position.stop)} · target {formatPrice(position.target)} · now {formatPct(position.pnlPct)} · {formatR(position.r)}
            </p>
            {position.line ? <p className="mt-3 text-sm leading-6 text-muted">{position.line}</p> : null}
            {position.thesis ? <p className="mt-2 text-sm leading-6">{position.thesis}</p> : null}
          </article>
        ))}
        {state.positions.length === 0 ? (
          <div className="rounded-lg border border-line bg-elev p-4">
            <Empty>No open positions.</Empty>
          </div>
        ) : null}
      </div>
      <RestingTable orders={state.resting} analyses={state.analyses} />
    </>
  );
}
