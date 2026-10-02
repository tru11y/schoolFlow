import Link from "next/link";
import { listLevels } from "@/infrastructure/db/levels";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import { TakeForm, type TimingView } from "./take-form";
import { resolveTiming } from "./timing";

function describeTiming(
  t: Awaited<ReturnType<typeof resolveTiming>>,
  role: string,
): TimingView {
  const { timing, isOverdue } = t;
  const slot = timing.slot;
  const window = slot ? `${slot.subject} ${slot.startTime.replace(":", "h")}-${slot.endTime.replace(":", "h")}` : "";

  if (timing.state === "IN_SLOT" && slot) return { tone: "green", text: `Cours de ${window} • En cours`, warn: null };

  const gap = timing.offsetMinutes;
  const gapText =
    gap === null ? "" : gap > 0 ? ` (terminé depuis ${gap} min)` : ` (commence dans ${Math.abs(gap)} min)`;
  const text = slot ? `Hors créneau • ${window}${gapText}` : "Hors créneau • aucun cours prévu aujourd'hui";
  return {
    tone: "orange",
    text,
    warn: isOverdue
      ? "L'appel sera enregistré mais signalé comme tardif dans le journal d'audit."
      : role === "TEACHER" ? null : "Appel administrateur : autorisé à tout moment.",
  };
}

export default async function TakeAttendancePage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const principal = await requirePagePermission("attendance:write");
  const { level: rawLevel } = await searchParams;
  const db = tenantPrisma(principal);

  const profiles = await db.studentProfile.findMany({ where: { status: "ACTIVE" }, select: { level: true }, distinct: ["level"] });
  const known = new Set(profiles.map((p) => p.level));
  const configured = (await listLevels(db)).map((l) => l.name);
  const levels = [...configured.filter((l) => known.has(l)), ...[...known].filter((l) => !configured.includes(l))];
  const level = rawLevel && known.has(rawLevel) ? rawLevel : null;

  let content: React.ReactNode = <p className="text-ink/70">Choisissez une classe pour commencer l&apos;appel.</p>;

  if (level) {
    const now = new Date();
    const resolved = await resolveTiming(db, principal, level, now);
    const [students, existing] = await Promise.all([
      db.user.findMany({
        where: { role: "STUDENT", deletedAt: null, profile: { level, status: "ACTIVE" } },
        orderBy: { lastName: "asc" },
        select: { id: true, firstName: true, lastName: true },
      }),
      resolved.timing.slot
        ? db.attendanceSession.findFirst({
            where: { slotId: resolved.timing.slot.id, date: resolved.date },
            select: { records: { select: { studentId: true, status: true } } },
          })
        : null,
    ]);
    const previous = new Map(existing?.records.map((r) => [r.studentId, r.status]));

    content = (
      <TakeForm
        key={level}
        level={level}
        timing={describeTiming(resolved, principal.role)}
        students={students.map((s) => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`,
          status: previous.get(s.id) ?? "PRESENT",
        }))}
      />
    );
  }

  return (
    <>
      <Link href="/absences" className="mb-4 inline-block text-sm text-ink/70 hover:text-ink">← Absences</Link>
      <PageTitle title="Appel express" subtitle={new Date().toLocaleDateString("fr-FR", { dateStyle: "full" })} />

      <nav aria-label="Choix de la classe" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {levels.map((l) => (
          <Link
            key={l}
            href={`/absences/take?level=${encodeURIComponent(l)}`}
            aria-current={l === level ? "page" : undefined}
            className={`min-h-11 whitespace-nowrap rounded-2xl px-5 py-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
              l === level ? "bg-accent text-canvas" : "bg-surface hover:bg-raised"
            }`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <Card>{content}</Card>
    </>
  );
}
