import { Suspense } from "react";
import { unlock } from "./actions";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ice">Kraken spot · ten lanes</p>
      <div className="orbit-mark mt-2">
        <span className="orbit-ring" aria-hidden="true" />
        <h1 className="font-display text-4xl tracking-tight">Orbit</h1>
      </div>
      <p className="mt-6 text-lg leading-8 text-paper-dim">The desk is locked.</p>
      <form action={unlock} className="mt-6 rounded-3xl border border-[var(--line)] bg-ink-2/80 p-5">
        <label className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper-dim" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-3 w-full rounded-2xl border border-[var(--line)] bg-ink px-4 py-3 text-paper outline-none"
        />
        <Suspense>
          <Rejected searchParams={searchParams} />
        </Suspense>
        <button type="submit" className="mt-4 rounded-full bg-ice px-5 py-3 font-mono text-xs uppercase tracking-[0.18em] text-ink">
          Open
        </button>
      </form>
    </div>
  );
}

async function Rejected({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  if (params.error !== "1") return null;
  return <p className="mt-3 text-sm leading-6 text-rose">That password does not open the desk.</p>;
}
