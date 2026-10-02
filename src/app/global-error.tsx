"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body style={{ background: "#16161c", color: "#f4f4f7", fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div role="alert" style={{ textAlign: "center" }}>
          <h1>Un problème est survenu</h1>
          <button onClick={reset} style={{ padding: "12px 20px", borderRadius: 16, border: 0, background: "#b6b4ff", fontWeight: 600 }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
