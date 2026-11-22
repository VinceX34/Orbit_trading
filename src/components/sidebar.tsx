"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { lock } from "@/app/login/actions";
import { useDesk } from "@/components/desk-provider";
import { applyTheme } from "@/lib/theme";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/positions", label: "Positions" },
  { href: "/analysis", label: "Analysis" },
  { href: "/trades", label: "Trades" },
  { href: "/flows", label: "Flows" },
  { href: "/settings", label: "Settings" },
];

function active(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state } = useDesk();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("orbit-theme") || "system") === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-sidebar md:sticky md:top-0 md:h-screen md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:block">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-text text-[11px] font-medium text-bg">O</span>
            <span className="text-sm font-medium">Orbit</span>
          </Link>
          <form action={lock} className="md:hidden">
            <button type="submit" className="text-xs text-muted hover:text-text">
              Lock
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-0.5 md:px-2">
          {links.map((link) => {
            const on = active(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block shrink-0 rounded-md px-2.5 py-1.5 text-sm ${on ? "bg-sunken text-text" : "text-muted hover:bg-sunken hover:text-text"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <form action={lock} className="mt-6 hidden px-2 md:block">
          <button type="submit" className="rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-sunken hover:text-text">
            Lock
          </button>
        </form>
      </aside>
      <div className="min-w-0">
        <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-6">
          {state?.error ? <p className="mb-4 rounded-md border border-line bg-elev px-3 py-2 text-sm text-down">{state.error}</p> : null}
          {state?.notice ? <p className="mb-4 rounded-md border border-line bg-elev px-3 py-2 text-sm text-muted">{state.notice}</p> : null}
          {state && !state.configured ? (
            <p className="mb-4 rounded-md border border-line bg-elev px-3 py-2 text-sm text-muted">Missing in .env.local: {state.missing.join(", ")}.</p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
