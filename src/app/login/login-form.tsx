"use client";

import { ChevronDown, Eye, EyeOff, Loader2, Lock, Mail, ShieldAlert } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { loginAction, type LoginState } from "./actions";

export interface DemoAccount {
  label: string;
  email: string;
  password: string;
}

const initial: LoginState = { error: null };

/** Glass-like field shell: the halo follows keyboard/touch focus on the inner input. */
const shell =
  "group flex items-center gap-3 rounded-2xl bg-canvas/70 px-4 ring-1 ring-ink/15 transition focus-within:bg-canvas focus-within:ring-2 focus-within:ring-accent focus-within:shadow-[0_0_0_5px_color-mix(in_oklch,var(--accent)_22%,transparent)]";
const input =
  "h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-ink/40";

export function LoginForm({ next, demo }: { next: string; demo: DemoAccount[] | null }) {
  const [state, action, pending] = useActionState(loginAction, initial);
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fill(account: DemoAccount) {
    if (emailRef.current) emailRef.current.value = account.email;
    if (passwordRef.current) passwordRef.current.value = account.password;
    setShowPassword(false);
  }

  return (
    <form
      action={action}
      className="grid gap-5 rounded-[2rem] bg-surface/70 p-6 shadow-soft ring-1 ring-ink/10 backdrop-blur-2xl sm:p-8"
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Connexion</h2>
        <p className="mt-1 text-sm text-ink/70">Accédez à votre espace SchoolFlow.</p>
      </div>
      <input type="hidden" name="next" value={next} />

      <label className="grid gap-1.5 text-sm font-medium">
        Adresse e-mail
        <span className={shell}>
          <Mail className="size-5 shrink-0 text-ink/50 transition group-focus-within:text-accent" aria-hidden />
          <input
            ref={emailRef}
            className={input}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="vous@etablissement.fr"
            required
          />
        </span>
      </label>

      <label className="grid gap-1.5 text-sm font-medium">
        Mot de passe
        <span className={shell}>
          <Lock className="size-5 shrink-0 text-ink/50 transition group-focus-within:text-accent" aria-hidden />
          <input
            ref={passwordRef}
            className={input}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
            className="-mr-2 grid size-10 shrink-0 place-items-center rounded-xl text-ink/60 outline-none transition hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-accent active:scale-90"
          >
            {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </span>
      </label>

      <p role="alert" aria-live="polite" className={`flex min-h-5 items-center gap-2 text-sm text-danger ${state.error ? "" : "hidden"}`}>
        <ShieldAlert className="size-4 shrink-0" aria-hidden />
        {state.error}
      </p>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="relative grid h-12 place-items-center overflow-hidden rounded-2xl bg-gradient-to-b from-accent to-accent/85 text-base font-semibold text-canvas shadow-lg shadow-accent/25 outline-none transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/30 focus-visible:ring-4 focus-visible:ring-accent/40 active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-80"
      >
        <span className={`inline-flex items-center gap-2 transition ${pending ? "opacity-0" : "opacity-100"}`}>Se connecter</span>
        {pending ? (
          <span className="absolute inset-0 grid place-items-center" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span className="sr-only">Connexion en cours</span>
          </span>
        ) : null}
      </button>

      {demo ? (
        <details className="group rounded-2xl bg-canvas/50 ring-1 ring-ink/10">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-2xl px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
            Compte de démo
            <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            {demo.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fill(account)}
                className="min-h-11 rounded-xl bg-surface px-3 text-left text-xs font-medium ring-1 ring-ink/10 outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
              >
                {account.label}
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </form>
  );
}
