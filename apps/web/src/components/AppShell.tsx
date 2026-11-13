import { useQueryClient } from "@tanstack/react-query";
import { can } from "@releaseops/shared";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { logoutAccount } from "../api/client";
import { sessionQueryKey, useSession } from "../auth/session";
import { quietButtonClass } from "../ui";

function navClass(isActive: boolean): string {
  return isActive ? "text-sm text-emerald-300" : "text-sm text-zinc-400 hover:text-zinc-200";
}

export function AppShell() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = session.data;
  const canManageUsers = user ? can(user, "user:manage") : false;

  async function onLogout() {
    await logoutAccount();
    queryClient.setQueryData(sessionQueryKey, null);
    await navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/15 text-sm font-semibold text-emerald-300">
                R
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">ReleaseOps</p>
                <p className="text-xs text-zinc-400">CI/CD control plane</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <NavLink to="/" end className={({ isActive }) => navClass(isActive)}>
                Overview
              </NavLink>
              {canManageUsers ? (
                <NavLink to="/admin/users" className={({ isActive }) => navClass(isActive)}>
                  Users
                </NavLink>
              ) : null}
            </nav>
          </div>
          {user ? (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
                <span className="font-medium">{user.name}</span>
                <span className="ml-2 text-zinc-400 capitalize">{user.role}</span>
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-40 rounded-md border border-white/10 bg-[#0b0f14] p-2 shadow-lg">
                <button
                  type="button"
                  className={`${quietButtonClass} w-full`}
                  onClick={() => void onLogout()}
                >
                  Log out
                </button>
              </div>
            </details>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
