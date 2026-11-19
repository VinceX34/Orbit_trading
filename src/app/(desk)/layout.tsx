import Link from "next/link";
import { lock } from "../login/actions";

export default function DeskLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="flex items-end justify-between gap-6 border-b border-[var(--line)] pb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ice">Kraken spot · ten lanes</p>
          <div className="orbit-mark mt-2">
            <span className="orbit-ring" aria-hidden="true" />
            <Link href="/" className="font-display text-4xl tracking-tight">
              Orbit
            </Link>
          </div>
        </div>
        <nav className="flex items-center gap-5 font-mono text-xs uppercase tracking-[0.18em] text-paper-dim">
          <Link href="/" className="hover:text-paper">
            Desk
          </Link>
          <Link href="/log" className="hover:text-paper">
            Log
          </Link>
          <form action={lock}>
            <button type="submit" className="hover:text-paper">
              Lock
            </button>
          </form>
        </nav>
      </header>
      <main className="flex-1 py-8">{children}</main>
    </>
  );
}
