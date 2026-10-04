"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Makes the cause visible in the browser console / monitoring instead of a silent fallback screen.
    console.error("page error", error.message, error.digest ?? "");
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div role="alert" className="grid max-w-sm gap-4 rounded-3xl bg-surface p-8 text-center shadow-soft">
        <h1 className="text-xl font-semibold">Un problème est survenu</h1>
        <p className="text-sm text-ink/70">La page n&apos;a pas pu s&apos;afficher. Rechargez pour réessayer.</p>
        <div className="flex justify-center gap-3">
          <button onClick={reset} className="min-h-11 rounded-2xl bg-accent px-5 font-medium text-canvas active:scale-95">
            Réessayer
          </button>
          <a href="/login" className="grid min-h-11 place-items-center rounded-2xl px-5 text-ink/80 hover:bg-raised">
            Connexion
          </a>
        </div>
      </div>
    </main>
  );
}
