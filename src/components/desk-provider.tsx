"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { DeskState } from "@/lib/types";

type DeskApi = {
  state: DeskState | null;
  busyFlow: string | null;
  setFlow: (flowId: string, active: boolean) => Promise<void>;
  runFlow: (flowId: string) => Promise<void>;
};

const DeskContext = createContext<DeskApi | null>(null);

export function DeskProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<DeskState | null>(null);
  const [busyFlow, setBusyFlow] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/desk", { cache: "no-store" });
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    setState((await response.json()) as DeskState);
  }, [router]);

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
  }, [refresh, router]);

  async function send(flowId: string, body: { active?: boolean; run?: boolean }) {
    if (busyFlow) return;
    setBusyFlow(flowId);
    const response = await fetch("/api/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flowId, ...body }),
    });
    if (response.status === 401) {
      setBusyFlow(null);
      router.push("/login");
      return;
    }
    setState((await response.json()) as DeskState);
    setBusyFlow(null);
  }

  const api: DeskApi = {
    state,
    busyFlow,
    setFlow: (flowId, active) => send(flowId, { active }),
    runFlow: (flowId) => send(flowId, { run: true }),
  };

  return <DeskContext.Provider value={api}>{children}</DeskContext.Provider>;
}

export function useDesk(): DeskApi {
  const value = useContext(DeskContext);
  if (!value) throw new Error("useDesk must be used inside the desk.");
  return value;
}
