import { can, type Permission } from "@/core/domain/rbac/role";
import { prisma } from "@/infrastructure/db/prisma";
import { requireAuth } from "@/presentation/auth/guards";
import { Sidebar, type NavItem } from "@/presentation/components/sidebar";
import { Topbar } from "@/presentation/components/topbar";
import Link from "next/link";

const NAV: (NavItem & { permission?: Permission })[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "🏠" },
  { href: "/ai-assistant", label: "Copilote IA", icon: "✨", permission: "copilot:use" },
  { href: "/students", label: "Élèves", icon: "🎓", permission: "user:manage" },
  { href: "/compta", label: "Comptabilité", icon: "💳", permission: "finance:read" },
  { href: "/cahier-de-texte", label: "Cahier de texte", icon: "📓", permission: "homework:read" },
  { href: "/curriculum", label: "Programmes", icon: "📚", permission: "homework:read" },
  { href: "/absences", label: "Absences", icon: "🙋", permission: "attendance:read" },
  { href: "/admin/users", label: "Utilisateurs", icon: "👥", permission: "user:manage" },
  { href: "/admin/levels", label: "Niveaux", icon: "🏷️", permission: "user:manage" },
  { href: "/admin/settings", label: "Paramètres", icon: "⚙️", permission: "school:manage" },
  { href: "/admin/audit", label: "Journal d'audit", icon: "🛡️", permission: "audit:read" },
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
        {can(principal.role, "copilot:use") ? (
          <Link
            href="/ai-assistant"
            aria-label="Ouvrir le copilote IA"
            className="fixed bottom-5 right-5 z-20 grid size-14 place-items-center rounded-full bg-accent text-2xl text-canvas shadow-soft outline-none transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-accent/40 active:scale-95"
          >
            <span aria-hidden>✨</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
