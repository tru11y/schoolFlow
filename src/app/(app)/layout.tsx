import { can, type Permission } from "@/core/domain/rbac/role";
import { prisma } from "@/infrastructure/db/prisma";
import { requireAuth } from "@/presentation/auth/guards";
import { CopilotFab } from "@/presentation/components/copilot-fab";
import { Sidebar, type NavItem } from "@/presentation/components/sidebar";
import { Topbar } from "@/presentation/components/topbar";
import { OutboxSync } from "@/presentation/offline/outbox-sync";

const NAV: (NavItem & { permission?: Permission })[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "dashboard" },
  { href: "/ai-assistant", label: "Copilote IA", icon: "copilot", permission: "copilot:use" },
  { href: "/ai-assistant/competitors", label: "Concurrents / Benchmark", icon: "competitors", permission: "copilot:use" },
  { href: "/students", label: "Élèves", icon: "students", permission: "user:manage" },
  { href: "/compta", label: "Comptabilité", icon: "compta", permission: "finance:read" },
  { href: "/cahier-de-texte", label: "Cahier de texte", icon: "logbook", permission: "homework:read" },
  { href: "/curriculum", label: "Programmes", icon: "curriculum", permission: "homework:read" },
  { href: "/absences", label: "Absences", icon: "absences", permission: "attendance:read" },
  { href: "/admin/users", label: "Utilisateurs", icon: "users", permission: "user:manage" },
  { href: "/admin/trash", label: "Corbeille", icon: "trash", permission: "user:manage" },
  { href: "/admin/levels", label: "Niveaux", icon: "levels", permission: "user:manage" },
  { href: "/admin/timetable", label: "Emploi du temps", icon: "timetable", permission: "user:manage" },
  { href: "/admin/settings", label: "Paramètres", icon: "settings", permission: "school:manage" },
  { href: "/admin/audit", label: "Journal d'audit", icon: "audit", permission: "audit:read" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const principal = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: principal.userId },
    select: { firstName: true, lastName: true, school: { select: { name: true, logoDataUrl: true } } },
  });
  const items = NAV.filter((n) => !n.permission || can(principal.role, n.permission));

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar items={items} schoolName={user?.school?.name ?? "SchoolFlow"} hasLogo={Boolean(user?.school?.logoDataUrl)} />
      <div className="min-w-0 flex-1">
        <Topbar
          name={user ? `${user.firstName} ${user.lastName}` : ""}
          role={principal.role}
          school={user?.school?.name ?? "Plateforme"}
        />
        <main className="px-6 pb-12 md:px-10">{children}</main>
        {can(principal.role, "copilot:use") ? <CopilotFab /> : null}
        <OutboxSync />
      </div>
    </div>
  );
}
