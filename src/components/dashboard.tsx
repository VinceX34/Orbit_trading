"use client";

import { useDesk } from "@/components/desk-provider";
import { FlowList } from "@/components/flows-view";
import { LatestAnalysis } from "@/components/analysis-view";
import { PositionTable } from "@/components/positions-view";
import { PageTitle, Panel, Stat } from "@/components/ui";
import { formatPct, formatUsdc, formatWhen } from "@/lib/format";

export function Dashboard() {
  const { state } = useDesk();
  if (!state) return <p className="text-sm text-muted">Loading the desk…</p>;
  const resting = state.resting.length ? `${state.resting.length} resting` : "No resting orders";
  return (
    <>
      <PageTitle title="Dashboard" lede={state.asOf ? `Last round ${formatWhen(state.asOf)}, Amsterdam.` : "No round yet."} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="USDC" value={formatUsdc(state.equityQuote)} hint="Free cash plus open positions" />
        <Stat label="Today" value={formatPct(state.dayPnlPct)} hint="Since midnight in Amsterdam" />
        <Stat label="Open" value={String(state.positions.length)} hint={resting} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Open positions" href="/positions">
          <PositionTable positions={state.positions} analyses={state.analyses} compact />
        </Panel>
        <Panel title="Latest analysis" href="/analysis">
          <LatestAnalysis />
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="Flows" href="/flows">
          <FlowList compact />
        </Panel>
      </div>
    </>
  );
}
