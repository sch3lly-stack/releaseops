import { Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/15 text-sm font-semibold text-emerald-300">
              R
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">ReleaseOps</p>
              <p className="text-xs text-zinc-400">CI/CD control plane</p>
            </div>
          </div>
          <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Foundations</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
