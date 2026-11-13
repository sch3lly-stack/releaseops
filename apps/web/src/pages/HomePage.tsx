import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "../api/client";
import { useSession } from "../auth/session";

type ConnectionState = "checking" | "up" | "down";

function connectionState(isPending: boolean, isError: boolean): ConnectionState {
  if (isPending) return "checking";
  if (isError) return "down";
  return "up";
}

const statusCopy: Record<ConnectionState, { label: string; className: string }> = {
  checking: {
    label: "Checking",
    className: "bg-amber-400/10 text-amber-200",
  },
  up: {
    label: "Reachable",
    className: "bg-emerald-400/10 text-emerald-300",
  },
  down: {
    label: "Unreachable",
    className: "bg-red-400/10 text-red-300",
  },
};

export function HomePage() {
  const session = useSession();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => fetchHealth(),
    retry: 1,
    refetchInterval: 10_000,
  });

  const state = connectionState(health.isPending, health.isError);
  const status = statusCopy[state];
  const errorMessage =
    health.error instanceof Error ? health.error.message : "Unable to reach the API";

  return (
    <div className="flex flex-col gap-8">
      <section>
        <p className="text-sm font-medium text-emerald-300">Signed in</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Deployment control plane</h1>
        <p className="mt-3 max-w-2xl text-base text-zinc-400">
          ReleaseOps tracks builds, gates production behind approvals, and keeps an audit trail.
          {session.data ? ` You are signed in as ${session.data.name}.` : ""}
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-6" aria-live="polite">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">API</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </div>

        {health.data ? (
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-zinc-400">Service</dt>
              <dd className="mt-1 font-medium">{health.data.service}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Version</dt>
              <dd className="mt-1 font-medium">{health.data.version ?? "unknown"}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Status</dt>
              <dd className="mt-1 font-medium">{health.data.status}</dd>
            </div>
          </dl>
        ) : null}

        {health.isError ? <p className="mt-4 text-sm text-red-300">{errorMessage}</p> : null}

        <button
          type="button"
          onClick={() => void health.refetch()}
          className="mt-5 rounded-md border border-white/15 px-3 py-1.5 text-sm text-zinc-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          Check again
        </button>
      </section>

      <section>
        <h2 className="text-sm font-medium tracking-wide text-zinc-400 uppercase">Local stack</h2>
        <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <li className="rounded-lg border border-white/10 px-4 py-3">
            <p className="font-medium">API</p>
            <p className="mt-1 text-zinc-400">localhost:3001</p>
          </li>
          <li className="rounded-lg border border-white/10 px-4 py-3">
            <p className="font-medium">Web</p>
            <p className="mt-1 text-zinc-400">localhost:5173</p>
          </li>
          <li className="rounded-lg border border-white/10 px-4 py-3">
            <p className="font-medium">PostgreSQL</p>
            <p className="mt-1 text-zinc-400">localhost:5432</p>
          </li>
          <li className="rounded-lg border border-white/10 px-4 py-3">
            <p className="font-medium">Redis and Mailpit</p>
            <p className="mt-1 text-zinc-400">localhost:6379 · Mailpit UI localhost:8025</p>
          </li>
        </ul>
      </section>
    </div>
  );
}
