import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError, fetchSetup, registerAccount } from "../api/client";
import { sessionQueryKey, useSession } from "../auth/session";
import { LabelInput } from "../components/LabelInput";
import { primaryButtonClass } from "../ui";

export function RegisterPage() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setup = useQuery({ queryKey: ["auth-setup"], queryFn: fetchSetup, retry: false });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session.data) return <Navigate to="/" replace />;

  const needsInvite = setup.data?.needsInvite ?? false;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await registerAccount({
        name,
        email,
        password,
        ...(needsInvite ? { inviteToken } : {}),
      });
      queryClient.setQueryData(sessionQueryKey, user);
      navigate("/");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to create the account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {setup.isPending
          ? "Checking whether an invite is required."
          : needsInvite
            ? "Paste the invite token from your administrator."
            : "The first account becomes the administrator."}
      </p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <LabelInput label="Name" name="name" autoComplete="name" value={name} onChange={setName} />
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
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={setPassword}
        />
        <p className="-mt-2 text-xs text-zinc-400">Use at least 12 characters.</p>
        {needsInvite ? (
          <LabelInput
            label="Invite token"
            name="inviteToken"
            autoComplete="off"
            value={inviteToken}
            onChange={setInviteToken}
          />
        ) : null}
        {setup.isError ? (
          <p role="alert" className="text-sm text-red-300">
            {setup.error instanceof Error ? setup.error.message : "Unable to reach the API."}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : null}
        <button type="submit" className={primaryButtonClass} disabled={pending || setup.isPending}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-400">
        Already registered?{" "}
        <Link to="/login" className="text-emerald-300 hover:text-emerald-200">
          Sign in
        </Link>
      </p>
    </section>
  );
}
