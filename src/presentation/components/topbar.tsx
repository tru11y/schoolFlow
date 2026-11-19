import { ChevronDown, LogOut } from "lucide-react";
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "");
}

export function Topbar({ name, role, school }: { name: string; role: string; school: string }) {
  return (
    <header
      data-chrome
      className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-ink/5 bg-canvas/80 px-6 py-3.5 backdrop-blur-md md:px-10"
    >
      <p className="truncate text-sm font-medium text-ink/70">{school}</p>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-2xl bg-surface py-1.5 pl-1.5 pr-3 text-sm outline-none ring-1 ring-ink/10 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/15 text-xs font-semibold uppercase text-accent">
              {initials(name) || "?"}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-36 truncate font-medium">{name}</span>
              <span className="block text-xs text-ink/60">{ROLE_LABELS[role] ?? role}</span>
            </span>
            <ChevronDown className="size-4 text-ink/50" aria-hidden />
          </summary>
          <div className="absolute right-0 z-10 mt-2 grid w-64 gap-1 rounded-2xl bg-surface p-2 shadow-soft ring-1 ring-ink/10">
            <form action={logoutAction}>
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-raised">
                <LogOut className="size-4" aria-hidden /> Cet appareil
              </button>
            </form>
            <form action={logoutAllAction}>
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-danger hover:bg-raised">
                <LogOut className="size-4" aria-hidden /> Tous les appareils
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
