export const metadata = { title: "Hors ligne · SchoolFlow" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl">📶</div>
      <h1 className="text-2xl font-semibold tracking-tight">Vous êtes hors ligne</h1>
      <p className="text-ink/60">Cette page n'est pas encore en cache. Reconnectez-vous pour la charger ; les pages déjà visitées restent accessibles.</p>
    </main>
  );
}
