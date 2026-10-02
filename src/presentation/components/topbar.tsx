import { logoutAction } from "@/app/login/actions";

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
        <form action={logoutAction}>
          <button className="rounded-2xl bg-surface px-4 py-2 text-sm outline-none ring-1 ring-white/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95">
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}
