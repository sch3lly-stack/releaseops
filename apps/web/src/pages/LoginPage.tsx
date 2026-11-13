import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError, loginAccount } from "../api/client";
import { sessionQueryKey, useSession } from "../auth/session";
import { LabelInput } from "../components/LabelInput";
import { primaryButtonClass } from "../ui";

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session.data) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await loginAccount({ email, password });
      queryClient.setQueryData(sessionQueryKey, user);
      navigate("/");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Use the email and password for your ReleaseOps account.
      </p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <LabelInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
        <LabelInput
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
        {error ? (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={pending || session.isPending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-400">
        Need an account?{" "}
        <Link to="/register" className="text-emerald-300 hover:text-emerald-200">
          Register
        </Link>
      </p>
    </section>
  );
}
