import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-md items-center gap-3 px-6 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/15 text-sm font-semibold text-emerald-300">
            R
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">ReleaseOps</p>
            <p className="text-xs text-zinc-400">CI/CD control plane</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
