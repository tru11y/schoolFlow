"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const field =
    "w-full rounded-2xl bg-canvas px-4 py-3 outline-none ring-1 ring-white/15 focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <form action={action} className="grid w-full max-w-sm gap-4 rounded-3xl bg-surface p-8 shadow-soft">
      <h1 className="text-2xl font-semibold">Connexion</h1>
      <input type="hidden" name="next" value={next} />
      <label className="grid gap-1 text-sm">
        Adresse e-mail
        <input className={field} name="email" type="email" autoComplete="username" required />
      </label>
      <label className="grid gap-1 text-sm">
        Mot de passe
        <input className={field} name="password" type="password" autoComplete="current-password" required />
      </label>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-red-300">
        {state.error}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-accent px-4 py-3 font-medium text-canvas transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
