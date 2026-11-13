import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../auth/session";

export function ProtectedRoute() {
  const session = useSession();

  if (session.isPending) {
    return <p className="px-6 py-10 text-sm text-zinc-400">Checking your session…</p>;
  }

  if (!session.data) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
