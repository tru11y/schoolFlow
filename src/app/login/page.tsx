import { prisma } from "@/infrastructure/db/prisma";
import { ThemeToggle } from "@/presentation/components/theme-toggle";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const school = await prisma.school.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { name: true, academicYear: true, logoDataUrl: true },
  });

  return (
    <main className="relative grid min-h-dvh place-items-center px-5 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="grid w-full max-w-sm justify-items-center gap-6">
        <header className="grid justify-items-center gap-3 text-center">
          <div className="grid size-20 place-items-center overflow-hidden rounded-3xl bg-surface shadow-soft">
            {school?.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- public branding route, not optimizable
              <img src="/school-logo/public" alt="" className="size-full object-contain p-2" />
            ) : (
              <span className="text-4xl" aria-hidden>🎒</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{school?.name ?? "SchoolFlow"}</h1>
          {school ? (
            <p className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
              Année scolaire {school.academicYear}
            </p>
          ) : null}
          <p className="text-sm text-ink/70">Bienvenue ! Connectez-vous pour accéder à votre espace.</p>
        </header>
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
