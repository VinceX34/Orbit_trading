"use client";

import { useDesk } from "@/components/desk-provider";
import { PageTitle, Switch } from "@/components/ui";

export function FlowList({ compact }: { compact?: boolean }) {
  const { state, busyFlow, setFlow, runFlow } = useDesk();
  if (!state) return <p className="text-sm text-muted">Loading the desk…</p>;
  const grouped = state.exchanges.map((exchange) => ({
    exchange,
    flows: state.flows.filter((flow) => flow.exchangeId === exchange.id),
  }));
  return (
    <div className="space-y-6">
      {grouped.map(({ exchange, flows }) => (
        <section key={exchange.id}>
          {compact ? null : (
            <h2 className="mb-2 text-xs uppercase tracking-wide text-muted">
              {exchange.name} · {exchange.quote}
            </h2>
          )}
          <ul className="space-y-3">
            {flows.map((flow) => {
              const on = Boolean(flow.published);
              const busy = busyFlow === flow.id;
              return (
                <li key={flow.id} className="rounded-lg border border-line bg-elev px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        {flow.name} <span className="font-normal text-muted">· {flow.engine}</span>
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted">{flow.summary}</p>
                      <p className="mt-1 text-xs text-muted">
                        {flow.published === null ? "Not connected yet." : on ? "On. The next hour runs." : "Off. The next hour does not run."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{flow.published === null ? "Unknown" : on ? "On" : "Off"}</span>
                      <Switch on={on} disabled={!state.configured || busy || flow.published === null} label={`${flow.name} ${on ? "on" : "off"}`} onClick={() => void setFlow(flow.id, !on)} />
                    </div>
                  </div>
                  {compact ? null : (
                    <button
                      type="button"
                      disabled={!state.configured || busy}
                      onClick={() => void runFlow(flow.id)}
                      className="mt-3 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-sunken disabled:opacity-40"
                    >
                      {busy ? "Wait" : "Run now"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function FlowsPage() {
  return (
    <>
      <PageTitle
        title="Flows"
        lede="A flow is an n8n workflow tied to one exchange. Each one has its own switch. Another broker later is another exchange, with its own flow."
      />
      <FlowList />
    </>
  );
}
