import { Suspense } from "react";
import { unlock } from "./actions";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-text text-[11px] font-medium text-bg">O</span>
        <h1 className="text-sm font-medium">Orbit</h1>
      </div>
      <p className="mt-6 text-sm text-muted">The desk is locked.</p>
      <form action={unlock} className="mt-4 rounded-lg border border-line bg-elev p-4">
        <label className="text-xs text-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm outline-none"
        />
        <Suspense>
          <Rejected searchParams={searchParams} />
        </Suspense>
        <button type="submit" className="mt-4 rounded-md bg-text px-3 py-2 text-sm text-bg">
          Open
        </button>
      </form>
    </div>
  );
}

async function Rejected({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  if (params.error !== "1") return null;
  return <p className="mt-3 text-sm text-down">That password does not open the desk.</p>;
}
