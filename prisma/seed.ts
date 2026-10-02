import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { localParts } from "../src/core/domain/attendance/policy";
import { receiptHash } from "../src/core/domain/finance/receipt";
import { Argon2Hasher } from "../src/infrastructure/auth/argon2-hasher";

/**
 *   npm run db:seed        purge + full demo dataset
 *   npm run db:seed:prod   purge + owner account only (SuperAdmin + school) - client delivery
 *   npm run db:seed:live   rebuild today's 3e/4e schedule around "now" only, nothing else is touched
 */
const prisma = new PrismaClient();

const SCHOOL_ID = "00000000-0000-4000-8000-000000000001";
const LIVE_IDS = [
  "00000000-0000-4000-8000-0000000001a1",
  "00000000-0000-4000-8000-0000000001a2",
  "00000000-0000-4000-8000-0000000001a3",
];
const PASSWORD = process.env.SEED_PASSWORD ?? "Admin1234!";
const mode = process.argv.includes("--prod") ? "prod" : process.argv.includes("--live") ? "live" : "demo";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function assertPurgeAllowed() {
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://x@localhost/x").hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && process.env.FORCE_PURGE !== "1") {
    throw new Error(`Refusing to purge a non-local database (${host}). Set FORCE_PURGE=1 to override.`);
  }
  if (process.env.NODE_ENV === "production" && !process.env.SEED_PASSWORD) {
    throw new Error("Set SEED_PASSWORD explicitly when seeding production");
  }
}

/** Wipes every table, including the append-only audit log (its triggers are disabled for the purge only). */
async function purge() {
  assertPurgeAllowed();
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$transaction([
    prisma.$executeRawUnsafe("ALTER TABLE audit_logs DISABLE TRIGGER USER"),
    prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`),
    prisma.$executeRawUnsafe("ALTER TABLE audit_logs ENABLE TRIGGER USER"),
  ]);
}

async function createOwner() {
  const school = await prisma.school.create({ data: { id: SCHOOL_ID, name: "SchoolFlow Academy" } });
  const passwordHash = await new Argon2Hasher().hash(PASSWORD);
  const user = (
    email: string,
    role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "ACCOUNTANT" | "TEACHER" | "STUDENT",
    firstName: string,
    lastName: string,
    extra: { phone?: string; specialty?: string; classLevels?: string[] } = {},
  ) => prisma.user.create({ data: { email, passwordHash, role, firstName, lastName, schoolId: school.id, ...extra } });
  return { school, user };
}

type Parent = { name: string; relation: string; phone: string; email?: string };
const STUDENTS: { first: string; last: string; email: string; level: "3e" | "4e"; birth: string; address: string; status: "ACTIVE" | "PENDING"; parents: Parent[] }[] = [
  { first: "Kouamé", last: "Yao", email: "eleve@schoolflow.app", level: "3e", birth: "2011-03-14", address: "Rue des Jardins, Cocody Riviera Palmeraie, Abidjan", status: "ACTIVE",
    parents: [{ name: "Kouassi Yao", relation: "Père", phone: "+225 07 48 12 36 90" }, { name: "Adjoua Yao", relation: "Mère", phone: "+225 05 76 21 43 08", email: "adjoua.yao@example.com" }] },
  { first: "Aïcha", last: "Traoré", email: "aicha.traore@schoolflow.app", level: "3e", birth: "2011-07-02", address: "Boulevard de Marseille, Marcory Zone 4, Abidjan", status: "ACTIVE",
    parents: [{ name: "Mariam Traoré", relation: "Mère", phone: "+225 01 52 33 90 17", email: "mariam.traore@example.com" }, { name: "Souleymane Traoré", relation: "Père", phone: "+225 07 09 44 18 62" }] },
  { first: "Lucas", last: "Bernard", email: "lucas.bernard@schoolflow.app", level: "3e", birth: "2010-12-19", address: "Avenue Jean Mermoz, Cocody Angré, Abidjan", status: "ACTIVE",
    parents: [{ name: "Philippe Bernard", relation: "Père", phone: "+33 6 12 45 78 90", email: "philippe.bernard@example.com" }, { name: "Nadia Bernard", relation: "Mère", phone: "+33 6 98 21 54 37" }] },
  { first: "Jean-Baptiste", last: "N'Guessan", email: "jeanbaptiste.nguessan@schoolflow.app", level: "4e", birth: "2012-02-08", address: "Rue Lepic, Plateau, Abidjan", status: "ACTIVE",
    parents: [{ name: "Éric N'Guessan", relation: "Père", phone: "+225 07 87 65 21 09" }, { name: "Estelle N'Guessan", relation: "Mère", phone: "+225 05 03 18 76 54", email: "estelle.nguessan@example.com" }] },
  { first: "Emma", last: "Laurent", email: "emma.laurent@schoolflow.app", level: "4e", birth: "2012-09-21", address: "Rue des Orchidées, Cocody II Plateaux, Abidjan", status: "ACTIVE",
    parents: [{ name: "Sophie Laurent", relation: "Mère", phone: "+33 7 61 23 45 89", email: "sophie.laurent@example.com" }, { name: "Antoine Laurent", relation: "Père", phone: "+33 6 34 56 78 12" }] },
  { first: "Ismaël", last: "Ouattara", email: "ismael.ouattara@schoolflow.app", level: "4e", birth: "2012-04-30", address: "Cité SICOGI, Abobo, Abidjan", status: "ACTIVE",
    parents: [{ name: "Lassina Ouattara", relation: "Père", phone: "+225 07 22 91 05 73" }] },
];

/** [weekday, start, end, subject, teacher] - Marc: Maths + SVT, Camille: Français + Histoire-Géo; never in two rooms at once. */
const WEEK: Record<"3e" | "4e", [number, string, string, string, "marc" | "camille"][]> = {
  "3e": [
    [1, "08:00", "09:30", "Mathématiques", "marc"], [1, "09:45", "11:15", "Français", "camille"], [1, "14:00", "15:30", "Histoire-Géo", "camille"],
    [2, "08:00", "09:30", "SVT", "marc"], [2, "09:45", "11:15", "Mathématiques", "marc"], [2, "15:45", "17:15", "Français", "camille"],
    [3, "08:00", "09:30", "Français", "camille"], [3, "09:45", "11:15", "Histoire-Géo", "camille"],
    [4, "08:00", "09:30", "Mathématiques", "marc"], [4, "09:45", "11:15", "Français", "camille"], [4, "14:00", "15:30", "Mathématiques", "marc"],
    [5, "08:00", "09:30", "Histoire-Géo", "camille"], [5, "09:45", "11:15", "SVT", "marc"],
  ],
  "4e": [
    [1, "08:00", "09:30", "Français", "camille"], [1, "09:45", "11:15", "Mathématiques", "marc"], [1, "14:00", "15:30", "SVT", "marc"],
    [2, "08:00", "09:30", "Histoire-Géo", "camille"], [2, "09:45", "11:15", "Français", "camille"], [2, "15:45", "17:15", "Mathématiques", "marc"],
    [3, "08:00", "09:30", "Mathématiques", "marc"], [3, "09:45", "11:15", "SVT", "marc"],
    [4, "08:00", "09:30", "Histoire-Géo", "camille"], [4, "09:45", "11:15", "Mathématiques", "marc"], [4, "14:00", "15:30", "Français", "camille"],
    [5, "08:00", "09:30", "SVT", "marc"], [5, "09:45", "11:15", "Français", "camille"],
  ],
};

/** Today's schedule for 3e/4e is rebuilt around "now": one class in progress, one finished, one upcoming. */
async function refreshLiveSlots(teachers: { marc: string; camille: string }) {
  const { weekday, minutes } = localParts(new Date());
  const now = Math.floor(minutes / 5) * 5;
  const live = [
    { id: LIVE_IDS[0]!, level: "3e", subject: "Mathématiques", teacherId: teachers.marc, room: "Salle 3A", start: now - 20, end: now + 70 },
    { id: LIVE_IDS[1]!, level: "4e", subject: "Français", teacherId: teachers.camille, room: "Salle 4A", start: now - 150, end: now - 60 },
    { id: LIVE_IDS[2]!, level: "3e", subject: "Histoire-Géo", teacherId: teachers.camille, room: "Salle 3A", start: now + 80, end: now + 170 },
  ]
    .map((s) => ({ ...s, start: Math.max(0, s.start), end: Math.min(1439, s.end) }))
    .filter((s) => s.end > s.start);

  await prisma.timetableSlot.deleteMany({ where: { schoolId: SCHOOL_ID, level: { in: ["3e", "4e"] }, weekday } });
  await prisma.timetableSlot.createMany({
    data: live.map((s) => ({
      id: s.id, schoolId: SCHOOL_ID, level: s.level, weekday, subject: s.subject, teacherId: s.teacherId,
      room: s.room, startTime: hhmm(s.start), endTime: hhmm(s.end),
    })),
  });
  for (const s of live) console.log(`  live ${s.level} ${s.subject} ${hhmm(s.start)}-${hhmm(s.end)}`);
}

async function seedDemo() {
  const { school, user } = await createOwner();
  await user("admin@schoolflow.app", "SUPER_ADMIN", "Admin", "SchoolFlow");
  await user("direction@schoolflow.app", "SCHOOL_ADMIN", "Mariam", "Diallo", { phone: "+225 07 11 20 30 40" });
  await user("compta@schoolflow.app", "ACCOUNTANT", "Séverine", "Kouadio", { phone: "+225 05 22 33 44 55" });
  const camille = await user("camille.martin@schoolflow.app", "TEACHER", "Camille", "Martin", {
    phone: "+225 07 66 77 88 99", specialty: "Français", classLevels: ["3e", "4e"],
  });
  const marc = await user("marc.dubois@schoolflow.app", "TEACHER", "Marc", "Dubois", {
    phone: "+225 05 99 88 77 66", specialty: "Mathématiques", classLevels: ["3e", "4e"],
  });
  const teacherOf = { marc: marc.id, camille: camille.id };

  const students = [];
  for (const s of STUDENTS) {
    const u = await user(s.email, "STUDENT", s.first, s.last);
    await prisma.studentProfile.create({
      data: { schoolId: school.id, userId: u.id, birthDate: date(s.birth), level: s.level, address: s.address, status: s.status },
    });
    await prisma.parentContact.createMany({
      data: s.parents.map((p, position) => ({ schoolId: school.id, studentId: u.id, position, name: p.name, relation: p.relation, phone: p.phone, email: p.email ?? null })),
    });
    students.push({ ...s, id: u.id });
  }

  await prisma.timetableSlot.createMany({
    data: (Object.entries(WEEK) as [string, (typeof WEEK)["3e"]][]).flatMap(([level, rows]) =>
      rows.map(([weekday, startTime, endTime, subject, who]) => ({
        schoolId: school.id, level, weekday, startTime, endTime, subject, teacherId: teacherOf[who],
        room: subject === "SVT" ? "Labo SVT" : `Salle ${level === "3e" ? "3A" : "4A"}`,
      })),
    ),
  });
  await refreshLiveSlots(teacherOf);

  const courseDefs = [
    { name: "Mathématiques - Renforcement 3e", level: "3e", weekday: 1, startTime: "17:30" },
    { name: "Français - Méthodologie 3e", level: "3e", weekday: 3, startTime: "17:30" },
    { name: "Mathématiques - Renforcement 4e", level: "4e", weekday: 2, startTime: "17:30" },
    { name: "Français - Méthodologie 4e", level: "4e", weekday: 4, startTime: "17:30" },
  ];
  for (const c of courseDefs) {
    const course = await prisma.course.create({ data: { schoolId: school.id, name: c.name, weekday: c.weekday, startTime: c.startTime } });
    await prisma.courseEnrollment.createMany({
      data: students.filter((s) => s.level === c.level && s.status === "ACTIVE").map((s) => ({ schoolId: school.id, courseId: course.id, studentId: s.id })),
    });
  }

  const months = [
    { label: "Septembre 2026", due: "2026-09-30", paidAt: "2026-09-12" },
    { label: "Octobre 2026", due: "2026-10-31", paidAt: "2026-10-01" },
    { label: "Novembre 2026", due: "2026-11-30", paidAt: null },
  ];
  const invoices = students.flatMap((s, i) =>
    months.map((m, mi) => {
      const paid = s.status === "ACTIVE" && ((mi === 0 && i !== 3) || (mi === 1 && [0, 1, 4].includes(i)));
      const id = randomUUID();
      const amountCents = 12_000;
      const paidAt = paid && m.paidAt ? new Date(`${m.paidAt}T10:00:00.000Z`) : null;
      return {
        id, schoolId: school.id, studentId: s.id, label: `Cours de renforcement - ${m.label}`, amountCents, dueDate: date(m.due),
        status: paidAt ? ("PAID" as const) : ("PENDING" as const), paidAt,
        receiptHash: paidAt ? receiptHash({ invoiceId: id, schoolId: school.id, studentId: s.id, amountCents, paidAt }) : null,
      };
    }),
  );
  await prisma.invoice.createMany({ data: invoices });

  const active = students.filter((s) => s.status === "ACTIVE");
  const today = localParts(new Date()).date;
  for (const back of [1, 2, 3]) {
    const d = new Date(date(today).getTime() - back * 86_400_000);
    for (const [level, subject, teacher] of [["3e", "Mathématiques", marc], ["4e", "Français", camille]] as const) {
      const session = await prisma.attendanceSession.create({
        data: {
          schoolId: school.id, level, subject, date: d, recorderId: teacher.id, teacherId: teacher.id,
          submittedAt: new Date(d.getTime() + 10 * 3_600_000), isOverdue: false, offsetMinutes: 0,
        },
      });
      await prisma.attendanceRecord.createMany({
        data: active.filter((s) => s.level === level).map((s, i) => ({
          schoolId: school.id, studentId: s.id, sessionId: session.id, date: d,
          status: back === 2 && i === 1 ? ("ABSENT" as const) : back === 3 && i === 2 ? ("LATE" as const) : ("PRESENT" as const),
        })),
      });
    }
  }

  await prisma.homework.createMany({
    data: [
      { schoolId: school.id, authorId: marc.id, title: "Maths 3e - Équations et inéquations", content: "Reprendre le chapitre 4.\n\n- Exercices 12 à 18 page 87\n- Apprendre les méthodes de résolution\n\nContrôle jeudi prochain." },
      { schoolId: school.id, authorId: camille.id, title: "Français 4e - Lecture suivie", content: "Lire les chapitres 5 et 6 du roman étudié.\n\nPréparer un résumé de 10 lignes et relever trois passages descriptifs." },
    ],
  });
}

async function main() {
  if (mode === "live") {
    const [camille, marc] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: "camille.martin@schoolflow.app" } }),
      prisma.user.findUniqueOrThrow({ where: { email: "marc.dubois@schoolflow.app" } }),
    ]);
    console.log("Refreshing live slots:");
    await refreshLiveSlots({ marc: marc.id, camille: camille.id });
    return;
  }

  await purge();
  if (mode === "prod") {
    const { user } = await createOwner();
    await user("admin@schoolflow.app", "SUPER_ADMIN", "Admin", "SchoolFlow");
    console.log("Database purged. Created: school 'SchoolFlow Academy' + SuperAdmin admin@schoolflow.app");
    if (!process.env.SEED_PASSWORD) console.log("Default password in use - change it before delivery (or set SEED_PASSWORD).");
    return;
  }

  console.log("Seeding demo dataset:");
  await seedDemo();
  console.log(`Done. All accounts use password "${PASSWORD}":`);
  console.log("  admin@schoolflow.app (SuperAdmin) | direction@schoolflow.app (Direction) | compta@schoolflow.app (Comptable)");
  console.log("  camille.martin@schoolflow.app (Français) | marc.dubois@schoolflow.app (Maths)");
  console.log("  eleve@schoolflow.app (Kouamé Yao, 3e)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
