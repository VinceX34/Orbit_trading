import type { ReactNode } from "react";
import Link from "next/link";

export function PageTitle({ title, lede }: { title: string; lede?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-lg font-medium tracking-tight">{title}</h1>
      {lede ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{lede}</p> : null}
    </div>
  );
}

export function Panel({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-elev">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {href ? (
          <Link href={href} className="text-xs text-muted hover:text-text">
            Open
          </Link>
        ) : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-elev px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted">{children}</p>;
}

export function sideClass(side: string | null): string {
  if (side === "long" || side === "buy") return "text-up";
  if (side === "short" || side === "sell") return "text-down";
  return "text-muted";
}

export function Switch({ on, disabled, label, onClick }: { on: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full border border-line transition disabled:opacity-70 ${on ? "bg-accent" : "bg-sunken"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full shadow-sm ${on ? "left-[22px] bg-white" : "left-0.5 bg-text"}`} />
    </button>
  );
}
