import { PrismaClient } from "@prisma/client";
import { localParts } from "../src/core/domain/attendance/policy";
import { receiptHash } from "../src/core/domain/finance/receipt";
import { Argon2Hasher } from "../src/infrastructure/auth/argon2-hasher";

const prisma = new PrismaClient();

const SCHOOL_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "Admin1234!";

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_PASSWORD) {
    throw new Error("Refusing to seed demo credentials in production without SEED_PASSWORD");
  }

  const school = await prisma.school.upsert({
    where: { id: SCHOOL_ID },
    update: {},
    create: { id: SCHOOL_ID, name: "SchoolFlow Academy" },
  });

  const passwordHash = await new Argon2Hasher().hash(DEMO_PASSWORD);
  const upsertUser = (email: string, role: "SUPER_ADMIN" | "TEACHER" | "STUDENT", firstName: string, lastName: string) =>
    prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, role, firstName, lastName, schoolId: school.id },
    });

  await upsertUser("admin@schoolflow.app", "SUPER_ADMIN", "Alex", "Admin");
  const teacher = await upsertUser("prof@schoolflow.app", "TEACHER", "Camille", "Martin");
  const teacher2 = await upsertUser("prof2@schoolflow.app", "TEACHER", "Karim", "Benali");
  const student = await upsertUser("eleve@schoolflow.app", "STUDENT", "Louis", "Dupont");
  const student2 = await upsertUser("eleve2@schoolflow.app", "STUDENT", "Emma", "Bernard");

  const extra = await Promise.all([
    upsertUser("lea.moreau@schoolflow.app", "STUDENT", "Léa", "Moreau"),
    upsertUser("hugo.petit@schoolflow.app", "STUDENT", "Hugo", "Petit"),
    upsertUser("ines.roux@schoolflow.app", "STUDENT", "Inès", "Roux"),
  ]);

  const profiles = [
    { user: student, level: "3e", birth: "2011-04-12", address: "12 rue des Lilas, 75011 Paris", status: "ACTIVE" },
    { user: student2, level: "4e", birth: "2012-09-03", address: "5 avenue Victor Hugo, 69003 Lyon", status: "ACTIVE" },
    { user: extra[0]!, level: "3e", birth: "2011-01-27", address: "8 chemin du Moulin, 31000 Toulouse", status: "ACTIVE" },
    { user: extra[1]!, level: "5e", birth: "2013-06-18", address: "21 rue Pasteur, 33000 Bordeaux", status: "PENDING" },
    { user: extra[2]!, level: "2nde", birth: "2010-11-30", address: "3 place du Marché, 44000 Nantes", status: "ARCHIVED" },
  ] as const;

  for (const p of profiles) {
    const data = {
      schoolId: school.id,
      birthDate: new Date(p.birth),
      level: p.level,
      address: p.address,
      status: p.status,
    };
    await prisma.studentProfile.upsert({ where: { userId: p.user.id }, update: {}, create: { userId: p.user.id, ...data } });
  }

  type Parent = { name: string; relation: string; phone?: string; email?: string };
  const parentsByStudent: [{ id: string }, Parent[]][] = [
    [student, [
      { name: "Marc Dupont", relation: "Père", phone: "06 11 22 33 44", email: "marc.dupont@example.com" },
      { name: "Marie Dupont", relation: "Mère", phone: "06 55 66 77 88", email: "marie.dupont@example.com" },
    ]],
    [student2, [
      { name: "Paul Bernard", relation: "Père", phone: "06 12 34 56 78" },
      { name: "Nadia Bernard", relation: "Mère", phone: "06 98 76 54 32", email: "nadia.bernard@example.com" },
    ]],
    [extra[0]!, [
      { name: "Sophie Moreau", relation: "Mère", email: "sophie.moreau@example.com", phone: "07 11 11 22 22" },
      { name: "Antoine Moreau", relation: "Oncle", phone: "07 33 44 55 66" },
    ]],
    [extra[1]!, [{ name: "Julien Petit", relation: "Père", phone: "07 98 76 54 32" }]],
    [extra[2]!, [{ name: "Claire Roux", relation: "Tuteur légal", email: "claire.roux@example.com" }]],
  ];
  for (const [s, parents] of parentsByStudent) {
    for (const [position, p] of parents.entries()) {
      const data = { name: p.name, relation: p.relation, phone: p.phone ?? null, email: p.email ?? null };
      await prisma.parentContact.upsert({
        where: { studentId_position: { studentId: s.id, position } },
        update: data,
        create: { schoolId: school.id, studentId: s.id, position, ...data },
      });
    }
  }

  if ((await prisma.timetableSlot.count({ where: { schoolId: school.id } })) === 0) {
    const m = teacher.id;
    const k = teacher2.id;
    // [weekday, start, end, subject, teacher, room]
    const week: Record<string, [number, string, string, string, string, string][]> = {
      "3e": [
        [1, "08:30", "10:00", "Mathématiques", m, "B12"], [1, "10:15", "11:45", "Français", k, "B14"], [1, "14:00", "15:30", "Anglais", k, "A03"],
        [2, "08:30", "10:00", "Histoire-Géo", k, "B14"], [2, "10:15", "11:45", "Anglais", k, "A03"], [2, "14:00", "15:30", "SVT", m, "Labo 1"],
        [3, "08:30", "10:00", "Physique-Chimie", m, "Labo 2"], [3, "10:15", "11:15", "EPS", k, "Gymnase"],
        [4, "08:30", "10:00", "Mathématiques", m, "B12"], [4, "14:00", "15:30", "Français", k, "B14"], [4, "15:45", "17:15", "Technologie", m, "C01"],
        [5, "08:30", "10:00", "Anglais", k, "A03"], [5, "10:15", "11:45", "Mathématiques", m, "B12"], [5, "14:00", "15:30", "Arts plastiques", k, "C02"],
      ],
      "4e": [
        [1, "09:00", "10:30", "Français", k, "B14"], [1, "10:45", "12:15", "Mathématiques", m, "B12"],
        [2, "09:00", "10:30", "Anglais", k, "A03"], [2, "13:30", "15:00", "Histoire-Géo", k, "B14"],
        [3, "09:00", "10:30", "Mathématiques", m, "B12"], [3, "10:45", "11:45", "EPS", k, "Gymnase"],
        [4, "09:00", "10:30", "SVT", m, "Labo 1"], [4, "13:30", "15:00", "Français", k, "B14"],
        [5, "09:00", "10:30", "Physique-Chimie", m, "Labo 2"], [5, "10:45", "12:15", "Anglais", k, "A03"],
      ],
    };
    await prisma.timetableSlot.createMany({
      data: Object.entries(week).flatMap(([level, rows]) =>
        rows.map(([weekday, startTime, endTime, subject, teacherId, room]) => ({
          schoolId: school.id, level, weekday, startTime, endTime, subject, teacherId, room,
        })),
      ),
    });
  }

  // Live demo slots, rebuilt around "now" (school timezone) on every seed run:
  // 3e Maths in progress, 4e Français already finished (-> late roll call warning).
  {
    const { weekday, minutes } = localParts(new Date());
    const hour = Math.floor(minutes / 60);
    const t = (h: number) => (h >= 24 ? "23:59" : `${String(Math.max(h, 0)).padStart(2, "0")}:00`);
    await prisma.timetableSlot.deleteMany({ where: { schoolId: school.id, room: "Démo" } });
    const live = [
      { level: "3e", subject: "Mathématiques", start: hour - 1, end: hour + 2 },
      ...(hour >= 4 ? [{ level: "4e", subject: "Français", start: hour - 4, end: hour - 2 }] : []),
    ];
    await prisma.timetableSlot.createMany({
      data: live.map((l) => ({
        schoolId: school.id, level: l.level, weekday, subject: l.subject, startTime: t(l.start), endTime: t(l.end),
        teacherId: teacher.id, room: "Démo",
      })),
    });
    console.log(`Live demo slots created for weekday ${weekday} around ${t(hour)} (teacher: prof@schoolflow.app)`);
  }

  if ((await prisma.course.count({ where: { schoolId: school.id } })) === 0) {
    const courses = await Promise.all(
      [
        { name: "Maths - Renforcement 3e", weekday: 1, startTime: "17:30" },
        { name: "Français - Méthodologie", weekday: 3, startTime: "17:30" },
        { name: "Anglais - Oral", weekday: 5, startTime: "17:00" },
      ].map((c) => prisma.course.create({ data: { ...c, schoolId: school.id } })),
    );
    const links = [
      [student, courses[0]!], [student, courses[1]!], [student2, courses[1]!],
      [extra[0]!, courses[0]!], [extra[0]!, courses[2]!], [extra[1]!, courses[2]!],
    ] as const;
    await prisma.courseEnrollment.createMany({
      data: links.map(([s, c]) => ({ schoolId: school.id, studentId: s.id, courseId: c.id })),
      skipDuplicates: true,
    });
  }

  if ((await prisma.invoice.count({ where: { schoolId: school.id } })) === 0) {
    const paidAt = new Date();
    const paid = {
      invoiceId: "00000000-0000-4000-8000-0000000000a1",
      schoolId: school.id,
      studentId: student.id,
      amountCents: 12000,
      paidAt,
    };
    await prisma.invoice.createMany({
      data: [
        {
          id: paid.invoiceId, schoolId: school.id, studentId: student.id, label: "Cours de renforcement - Septembre",
          amountCents: paid.amountCents, dueDate: new Date("2026-09-30"), status: "PAID", paidAt, receiptHash: receiptHash(paid),
        },
        { schoolId: school.id, studentId: student.id, label: "Cours de renforcement - Octobre", amountCents: 12000, dueDate: new Date("2026-10-31") },
        { schoolId: school.id, studentId: student2.id, label: "Cours de renforcement - Octobre", amountCents: 9500, dueDate: new Date("2026-10-31") },
      ],
    });
  }

  if ((await prisma.homework.count({ where: { schoolId: school.id } })) === 0) {
    await prisma.homework.create({
      data: {
        schoolId: school.id,
        authorId: teacher.id,
        title: "Maths - Fonctions affines",
        content: "Revoir le chapitre 3.\n\n- Exercices 4 a 9 p. 112\n- Apprendre la methode de resolution\n\nControle vendredi.",
      },
    });
  }

  console.log(`Seeded "${school.name}". Logins (password: ${DEMO_PASSWORD}):`);
  console.log("  admin@schoolflow.app  prof@schoolflow.app  eleve@schoolflow.app  eleve2@schoolflow.app");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
