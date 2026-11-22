"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useDesk } from "@/components/desk-provider";
import { PageTitle } from "@/components/ui";
import { applyTheme, currentTheme, type ThemeChoice } from "@/lib/theme";

const choices: { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

function subscribeTheme(onChange: () => void) {
  window.addEventListener("orbit-theme", onChange);
  return () => window.removeEventListener("orbit-theme", onChange);
}

export function SettingsPage() {
  const { state } = useDesk();
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "system" as ThemeChoice);

  return (
    <>
      <PageTitle title="Settings" lede="Appearance is saved in this browser. Exchanges and flows are the shape of the desk." />
      <section className="rounded-lg border border-line bg-elev p-4">
        <h2 className="text-sm font-medium">Appearance</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => applyTheme(choice.id)}
              className={`rounded-md border px-3 py-1.5 text-sm ${theme === choice.id ? "border-text bg-sunken" : "border-line hover:bg-sunken"}`}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </section>
      <section className="mt-4 rounded-lg border border-line bg-elev p-4">
        <h2 className="text-sm font-medium">Exchanges</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          An exchange is a broker account. A flow is the n8n workflow that trades on it. Adding a broker means a new exchange here, with its own flow and its own switch.
        </p>
        <ul className="mt-4 space-y-3">
          {(state?.exchanges || []).map((exchange) => {
            const attached = (state?.flows || []).filter((flow) => flow.exchangeId === exchange.id);
            return (
              <li key={exchange.id} className="rounded-md border border-line px-3 py-3">
                <p className="text-sm font-medium">
                  {exchange.name} <span className="font-normal text-muted">· {exchange.quote}</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {attached.length ? attached.map((flow) => flow.name).join(", ") : "No flow yet"}
                  {" · "}
                  <Link href="/flows" className="text-accent hover:underline">
                    Flows
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
