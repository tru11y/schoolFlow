"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { parseTimetableCsv, levelKey, type ParsedSlot, type RowError } from "@/core/domain/timetable/import";
import { parseTimetableGrid } from "@/core/domain/timetable/xlsx-grid";
import { resolveDownloadUrl } from "@/core/domain/timetable/source-url";
import { newShareToken } from "@/core/domain/timetable/share";
import { readSheetsAsGrids } from "@/infrastructure/xlsx/read-grid";
import { fetchRemoteFile } from "@/infrastructure/net/fetch-file";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { secureAction } from "@/presentation/secure-action";

type Db = ReturnType<typeof tenantPrisma>;

const normalize = (s: string): string =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

export interface ImportSummary {
  created: number;
  skipped: number;
  unknownTeachers: string[];
  unknownLevels: string[];
  errors: { line: number; message: string }[];
}

/** Résout niveaux/enseignants puis crée les créneaux. Partagé CSV + xlsx. */
async function persistImportedRows(
  db: Db,
  schoolId: string,
  rows: ParsedSlot[],
  errors: RowError[],
  replace: boolean,
): Promise<ImportSummary> {
  const [levels, teachers] = await Promise.all([
    db.gradeLevel.findMany({ select: { name: true } }),
    db.user.findMany({ where: { role: "TEACHER", deletedAt: null }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  // Correspondance tolérante : les libellés du fichier (TLE D, 3E, 2NDE A) sont
  // ramenés au nom exact du niveau enregistré (Terminale D, 3eme, 2nde A).
  const levelByKey = new Map<string, string>();
  for (const l of levels) levelByKey.set(levelKey(l.name), l.name);
  const teacherByName = new Map<string, string>();
  for (const t of teachers) {
    teacherByName.set(normalize(`${t.firstName} ${t.lastName}`), t.id);
    teacherByName.set(normalize(`${t.lastName} ${t.firstName}`), t.id);
  }

  const unknownLevels = new Set<string>();
  const unknownTeachers = new Set<string>();
  const toCreate: {
    schoolId: string; level: string; weekday: number; startTime: string; endTime: string;
    subject: string; teacherId: string | null; room: string | null;
  }[] = [];

  for (const row of rows) {
    const level = levelByKey.get(levelKey(row.level));
    if (!level) { unknownLevels.add(row.level); continue; }
    let teacherId: string | null = null;
    if (row.teacherName) {
      teacherId = teacherByName.get(normalize(row.teacherName)) ?? null;
      if (!teacherId) unknownTeachers.add(row.teacherName);
    }
    toCreate.push({
      schoolId, level, weekday: row.weekday, startTime: row.startTime,
      endTime: row.endTime, subject: row.subject, teacherId, room: row.room,
    });
  }

  const affectedLevels = [...new Set(toCreate.map((s) => s.level))];
  let skipped = 0;
  let created = 0;

  await db.$transaction(async (tx) => {
    if (replace && affectedLevels.length) {
      // Replace the class timetable for every level present in the file (student-specific slots untouched).
      await tx.timetableSlot.deleteMany({ where: { studentId: null, level: { in: affectedLevels } } });
    }
    const existing = replace
      ? new Set<string>()
      : new Set(
          (await tx.timetableSlot.findMany({
            where: { studentId: null, level: { in: affectedLevels } },
            select: { level: true, weekday: true, startTime: true, subject: true },
          })).map((s) => `${s.level}|${s.weekday}|${s.startTime}|${s.subject}`),
        );

    const seen = new Set<string>();
    const fresh = toCreate.filter((s) => {
      const key = `${s.level}|${s.weekday}|${s.startTime}|${s.subject}`;
      if (existing.has(key) || seen.has(key)) { skipped++; return false; }
      seen.add(key);
      return true;
    });
    if (fresh.length) {
      const res = await tx.timetableSlot.createMany({ data: fresh });
      created = res.count;
    }
  });

  revalidatePath("/admin/timetable");
  return { created, skipped, unknownTeachers: [...unknownTeachers], unknownLevels: [...unknownLevels], errors };
}

export const importTimetable = secureAction(
  {
    name: "timetable.import",
    resource: "timetable",
    permission: "user:manage",
    input: z.object({ csv: z.string().min(1).max(200_000), replace: z.boolean().default(false) }),
    resourceId: () => null,
    auditMetadata: (i) => ({ replace: i.replace }),
  },
  async ({ input, db, principal }): Promise<ImportSummary> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const { columns, rows, errors } = parseTimetableCsv(input.csv);
    if (!columns) throw new ForbiddenError("timetable:bad-columns");

    return persistImportedRows(db, schoolId, rows, errors, input.replace);
  },
);

export const importTimetableXlsx = secureAction(
  {
    name: "timetable.import-xlsx",
    resource: "timetable",
    permission: "user:manage",
    // Fichier .xlsx encodé en base64 (~1,4x la taille binaire ; plafond ~15 Mo).
    input: z.object({ xlsxBase64: z.string().min(1).max(15_000_000), replace: z.boolean().default(false) }),
    resourceId: () => null,
    auditMetadata: (i) => ({ replace: i.replace }),
  },
  async ({ input, db, principal }): Promise<ImportSummary> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");
    const rows = await parseXlsxBest(Buffer.from(input.xlsxBase64, "base64"));
    return persistImportedRows(db, schoolId, rows, [], input.replace);
  },
);

/** Parse un classeur .xlsx (grille) et retourne les créneaux du dernier onglet exploitable. */
async function parseXlsxBest(buffer: Buffer): Promise<ParsedSlot[]> {
  let sheets;
  try {
    sheets = await readSheetsAsGrids(buffer);
  } catch {
    throw new ForbiddenError("timetable:bad-xlsx");
  }
  let best: ParsedSlot[] | null = null;
  for (const { grid } of sheets) {
    const parsed = parseTimetableGrid(grid);
    if (parsed.columns && parsed.rows.length) best = parsed.rows;
  }
  if (!best) throw new ForbiddenError("timetable:bad-columns");
  return best;
}

export const importTimetableFromUrl = secureAction(
  {
    name: "timetable.import-url",
    resource: "timetable",
    permission: "user:manage",
    input: z.object({ url: z.string().min(1).max(2048), replace: z.boolean().default(false) }),
    resourceId: () => null,
    auditMetadata: (i) => ({ replace: i.replace }),
  },
  async ({ input, db, principal }): Promise<ImportSummary> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const resolved = resolveDownloadUrl(input.url);
    if ("error" in resolved) throw new ForbiddenError("timetable:bad-url");

    let file;
    try {
      file = await fetchRemoteFile(resolved.url);
    } catch {
      throw new ForbiddenError("timetable:fetch-failed");
    }

    // Détection xlsx (signature ZIP « PK ») vs CSV texte.
    const isXlsx = file.buffer.length > 1 && file.buffer[0] === 0x50 && file.buffer[1] === 0x4b;
    if (isXlsx) {
      const rows = await parseXlsxBest(file.buffer);
      return persistImportedRows(db, schoolId, rows, [], input.replace);
    }
    const { columns, rows, errors } = parseTimetableCsv(file.buffer.toString("utf8"));
    if (!columns) throw new ForbiddenError("timetable:bad-columns");
    return persistImportedRows(db, schoolId, rows, errors, input.replace);
  },
);

export const createShareLink = secureAction(
  {
    name: "timetable.share-create",
    resource: "timetable",
    permission: "user:manage",
    input: z.object({ level: z.string().min(1).max(60) }),
    resourceId: () => null,
    auditMetadata: (i) => ({ level: i.level }),
  },
  async ({ input, db, principal }): Promise<{ token: string }> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");
    const existing = await db.timetableShare.findFirst({ where: { level: input.level } });
    if (existing && !existing.revokedAt) return { token: existing.token };
    const token = newShareToken();
    if (existing) {
      await db.timetableShare.update({ where: { id: existing.id }, data: { token, revokedAt: null, createdById: principal.userId } });
    } else {
      await db.timetableShare.create({ data: { schoolId, level: input.level, token, createdById: principal.userId } });
    }
    revalidatePath("/admin/timetable");
    return { token };
  },
);

export const revokeShareLink = secureAction(
  {
    name: "timetable.share-revoke",
    resource: "timetable",
    permission: "user:manage",
    input: z.object({ level: z.string().min(1).max(60) }),
    resourceId: () => null,
    auditMetadata: (i) => ({ level: i.level }),
  },
  async ({ input, db }): Promise<{ ok: true }> => {
    await db.timetableShare.updateMany({ where: { level: input.level, revokedAt: null }, data: { revokedAt: new Date() } });
    revalidatePath("/admin/timetable");
    return { ok: true };
  },
);
