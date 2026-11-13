import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { can, userRoles, type UserRole } from "@releaseops/shared";
import { useState } from "react";
import { ApiError, createInvite, fetchUsers, updateUser } from "../api/client";
import { useSession } from "../auth/session";
import { LabelInput } from "../components/LabelInput";
import { fieldClass, primaryButtonClass, quietButtonClass } from "../ui";

function roleLabel(role: UserRole): string {
  if (role === "admin") return "Admin";
  if (role === "developer") return "Developer";
  return "Approver";
}

export function UsersPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const actor = session.data;
  const allowed = actor ? can(actor, "user:manage") : false;
  const users = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: allowed,
    retry: false,
  });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("developer");
  const [error, setError] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () => createInvite({ email, role }),
    onSuccess: (result) => {
      setIssuedToken(result.token);
      setEmail("");
      setError(null);
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : "Unable to create the invite.");
    },
  });

  const change = useMutation({
    mutationFn: (input: { id: string; role?: UserRole; isActive?: boolean }) =>
      updateUser(input.id, { role: input.role, isActive: input.isActive }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : "Unable to update that user.");
    },
  });

  if (!actor || !allowed) {
    return (
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-3 text-sm text-zinc-400">Only an administrator can manage users.</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Invite someone, change their role, or deactivate the account. The token is shown once.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-medium">Invite</h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          <LabelInput
            label="Email"
            name="invite-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={setEmail}
          />
          <label htmlFor="invite-role" className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Role</span>
            <select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className={fieldClass}
            >
              {userRoles.map((option) => (
                <option key={option} value={option}>
                  {roleLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={primaryButtonClass} disabled={invite.isPending}>
            {invite.isPending ? "Creating…" : "Create invite"}
          </button>
        </form>
        {issuedToken ? (
          <label htmlFor="invite-token" className="mt-4 flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Invite token</span>
            <input
              id="invite-token"
              readOnly
              value={issuedToken}
              aria-label="Invite token"
              onFocus={(event) => event.currentTarget.select()}
              className={fieldClass}
            />
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        ) : null}
      </section>

      <section className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-white/10 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Access</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((user) => {
              const isSelf = user.id === actor.id;
              return (
                <tr key={user.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {user.name}
                    {isSelf ? <span className="ml-2 text-xs text-zinc-400">You</span> : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{user.email}</td>
                  <td className="px-4 py-3">
                    <label className="sr-only" htmlFor={`role-${user.id}`}>
                      Role for {user.name}
                    </label>
                    <select
                      id={`role-${user.id}`}
                      value={user.role}
                      disabled={isSelf || change.isPending}
                      onChange={(event) =>
                        change.mutate({ id: user.id, role: event.target.value as UserRole })
                      }
                      className={fieldClass}
                    >
                      {userRoles.map((option) => (
                        <option key={option} value={option}>
                          {roleLabel(option)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={quietButtonClass}
                      disabled={isSelf || change.isPending}
                      onClick={() => change.mutate({ id: user.id, isActive: !user.isActive })}
                    >
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.isPending ? <p className="px-4 py-4 text-sm text-zinc-400">Loading users…</p> : null}
        {users.isError ? (
          <p className="px-4 py-4 text-sm text-red-300">
            {users.error instanceof Error ? users.error.message : "Unable to load users."}
          </p>
        ) : null}
      </section>
    </div>
  );
}
