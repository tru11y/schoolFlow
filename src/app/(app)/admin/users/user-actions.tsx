"use client";

import { useState, useTransition } from "react";
import type { Role } from "@/core/domain/rbac/role";
import { ROLE_LABELS, SWITCHABLE_ROLES } from "@/core/domain/rbac/user-management";
import { changeUserRole, resetUserPassword, setUserActive } from "./actions";

interface Props {
  id: string;
  role: Role;
  active: boolean;
  /** Roles the current user may assign */
  assignable: Role[];
}

const btn =
  "min-h-9 rounded-xl px-3 text-xs outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:opacity-60";

export function UserActions({ id, role, active, assignable }: Props) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, ok: string) =>
    start(async () => {
      const res = await fn();
      setMessage(res.ok ? ok : (res.error?.message ?? "Erreur"));
    });

  const roles = SWITCHABLE_ROLES.filter((r) => assignable.includes(r));

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {roles.length > 0 && role !== "STUDENT" ? (
        <select
          aria-label="Modifier le rôle"
          defaultValue={role}
          disabled={pending}
          onChange={(e) => run(() => changeUserRole({ id, role: e.target.value }), "Rôle modifié")}
          className="min-h-9 rounded-xl bg-canvas px-2 text-xs outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent"
        >
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      ) : null}
      <button
        disabled={pending}
        className={btn}
        onClick={() => run(() => setUserActive({ id, active: !active }), active ? "Compte désactivé" : "Compte activé")}
      >
        {active ? "Désactiver" : "Activer"}
      </button>
      <button
        disabled={pending}
        className={btn}
        onClick={() =>
          start(async () => {
            const res = await resetUserPassword({ id });
            setMessage(res.ok ? `Mot de passe provisoire : ${res.data.tempPassword}` : res.error.message);
          })
        }
      >
        Réinitialiser le mot de passe
      </button>
      {message ? (
        <span role="status" className="w-full text-right font-mono text-xs text-ink/80">{message}</span>
      ) : null}
    </div>
  );
}
