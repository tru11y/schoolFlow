import { logoutAction, logoutAllAction } from "@/app/login/actions";
import { ThemeToggle } from "./theme-toggle";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SCHOOL_ADMIN: "Direction",
  ACCOUNTANT: "Comptable",
  TEACHER: "Professeur",
  STUDENT: "Élève",
  PARENT: "Parent",
};

export function Topbar({ name, role, school }: { name: string; role: string; school: string }) {
  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4 md:px-10">
      <p className="text-sm text-ink/70">{school}</p>
      <div className="flex items-center gap-4">
        <div className="text-right text-sm leading-tight">
          <p className="font-medium">{name}</p>
          <p className="text-ink/70">{ROLE_LABELS[role] ?? role}</p>
        </div>
        <ThemeToggle />
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-2xl bg-surface px-4 py-2 text-sm outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95">
            Déconnexion ▾
          </summary>
          <div className="absolute right-0 z-10 mt-2 grid w-64 gap-1 rounded-2xl bg-surface p-2 shadow-soft ring-1 ring-ink/15">
            <form action={logoutAction}>
              <button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-raised">Cet appareil</button>
            </form>
            <form action={logoutAllAction}>
              <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-danger hover:bg-raised">
                Tous les appareils
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
