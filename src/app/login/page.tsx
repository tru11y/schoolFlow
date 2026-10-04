import { BookOpenCheck, CalendarCheck2, GraduationCap, ReceiptText } from "lucide-react";
import { getLoginBranding } from "@/infrastructure/db/branding";
import { ThemeToggle } from "@/presentation/components/theme-toggle";
import { LoginForm, type DemoAccount } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connexion · SchoolFlow" };

const FEATURES = [
  { icon: CalendarCheck2, label: "Appel express", hint: "Présences en un geste" },
  { icon: BookOpenCheck, label: "Cahier de texte", hint: "Cours et devoirs par classe" },
  { icon: ReceiptText, label: "Reçus certifiés", hint: "Vérifiables par QR code" },
] as const;

/** One-click demo accounts are opt-in (SHOW_DEMO_ACCOUNTS=1) and never shipped to a normal deployment. */
function demoAccounts(): DemoAccount[] | null {
  if (process.env.SHOW_DEMO_ACCOUNTS !== "1") return null;
  const password = process.env.SEED_PASSWORD ?? "Admin1234!";
  return [
    { label: "Super admin", email: "admin@schoolflow.app", password },
    { label: "Direction", email: "direction@schoolflow.app", password },
    { label: "Comptable", email: "compta@schoolflow.app", password },
    { label: "Professeur · Maths", email: "marc.dubois@schoolflow.app", password },
    { label: "Professeur · Français", email: "camille.martin@schoolflow.app", password },
    { label: "Élève", email: "eleve@schoolflow.app", password },
  ];
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const brand = await getLoginBranding();

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-canvas">
      {/* Luminous mesh: three drifting blurred orbs + a faint masked grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-28 size-[26rem] animate-drift rounded-full bg-accent/30 blur-3xl sm:size-[34rem]" />
        <div className="absolute -right-24 top-1/4 size-[24rem] animate-drift-slow rounded-full bg-sky/25 blur-3xl sm:size-[32rem]" />
        <div className="absolute -bottom-36 left-1/4 size-[28rem] animate-drift rounded-full bg-lilac/25 blur-3xl sm:size-[36rem]" />
        <div
          className="absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(var(--ink) 1px, transparent 1px), linear-gradient(90deg, var(--ink) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="mx-auto grid min-h-dvh w-full max-w-6xl content-center gap-8 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-10 lg:pt-10">
        <section className="animate-rise text-center lg:text-left">
          <div className="mx-auto grid size-16 place-items-center overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-accent to-lilac text-canvas shadow-soft ring-1 ring-ink/10 sm:size-20 lg:mx-0 lg:size-24 lg:rounded-[1.8rem]">
            {brand.hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic data-URL logo served by /school-logo/public
              <img src="/school-logo/public" alt="" className="size-full bg-surface object-contain p-1.5" />
            ) : (
              <GraduationCap className="size-8 sm:size-10 lg:size-12" aria-hidden />
            )}
          </div>

          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:mt-7 lg:text-5xl">{brand.name}</h1>
          <p className="mt-3 inline-flex items-center rounded-full bg-surface/70 px-4 py-1.5 text-sm font-medium ring-1 ring-ink/10 backdrop-blur-md">
            Année Scolaire {brand.academicYear}
          </p>
          <p className="mx-auto mt-4 max-w-md text-pretty text-base text-ink/75 lg:mx-0 lg:text-lg">{brand.welcomeMessage}</p>

          <ul className="mt-10 hidden gap-3 lg:grid lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, label, hint }, i) => (
              <li
                key={label}
                style={{ animationDelay: `${150 + i * 90}ms` }}
                className="animate-rise rounded-3xl bg-surface/60 p-4 ring-1 ring-ink/10 backdrop-blur-xl"
              >
                <Icon className="size-6 text-accent" aria-hidden />
                <p className="mt-3 text-sm font-semibold">{label}</p>
                <p className="mt-0.5 text-xs text-ink/70">{hint}</p>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ animationDelay: "120ms" }} className="animate-rise mx-auto w-full max-w-md lg:max-w-none">
          <LoginForm next={next ?? "/"} demo={demoAccounts()} />
        </section>
      </div>
    </main>
  );
}
