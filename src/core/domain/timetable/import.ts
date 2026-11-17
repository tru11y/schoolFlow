import { TIME_RE, toMinutes } from "../students/timetable";

export const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

const normalize = (s: string): string =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "Lundi"/"lun"/"1" → 1 … "Dimanche"/"dim"/"7" → 7. Null when unrecognized. */
export function parseWeekday(raw: string): number | null {
  const v = normalize(raw);
  if (/^[1-7]$/.test(v)) return Number(v);
  const i = WEEKDAY_LABELS.findIndex((d) => normalize(d) === v || normalize(d).startsWith(v) && v.length >= 3);
  return i === -1 ? null : i + 1;
}

/** Minimal RFC 4180 reader. Delimiter is auto-detected (`;` or `,`) from the header line. */
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const firstLine = body.slice(0, body.search(/\r?\n/) === -1 ? body.length : body.search(/\r?\n/));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"') {
        if (body[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      row.push(field); rows.push(row); field = ""; row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export interface ParsedSlot {
  level: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacherName: string | null;
  room: string | null;
}
export interface RowError {
  line: number;
  message: string;
}

const HEADERS = {
  level: ["classe", "niveau", "level"],
  weekday: ["jour", "day", "weekday"],
  start: ["debut", "start", "heure debut", "startTime", "de"],
  end: ["fin", "end", "heure fin", "endTime", "a"],
  subject: ["matiere", "subject", "cours"],
  teacher: ["enseignant", "professeur", "prof", "teacher"],
  room: ["salle", "room", "local"],
} as const;

/** Maps header cells to column indexes by fuzzy French/English names. */
function resolveColumns(header: string[]): Record<keyof typeof HEADERS, number> | null {
  const idx = (names: readonly string[]) =>
    header.findIndex((h) => names.includes(normalize(h)));
  const cols = {
    level: idx(HEADERS.level),
    weekday: idx(HEADERS.weekday),
    start: idx(HEADERS.start),
    end: idx(HEADERS.end),
    subject: idx(HEADERS.subject),
    teacher: idx(HEADERS.teacher),
    room: idx(HEADERS.room),
  };
  // The five identifying columns are mandatory; teacher and room are optional.
  if ([cols.level, cols.weekday, cols.start, cols.end, cols.subject].some((i) => i === -1)) return null;
  return cols;
}

/**
 * Parses the timetable CSV (with header row). Returns valid slots and per-line errors.
 * Pure: teacher names are passed through as text; resolution to a user happens in the action.
 */
export function parseTimetableCsv(text: string): { columns: boolean; rows: ParsedSlot[]; errors: RowError[] } {
  const grid = parseCsv(text);
  if (grid.length === 0) return { columns: false, rows: [], errors: [] };
  const cols = resolveColumns(grid[0]!);
  if (!cols) return { columns: false, rows: [], errors: [] };

  const rows: ParsedSlot[] = [];
  const errors: RowError[] = [];
  const at = (r: string[], i: number) => (i === -1 ? "" : (r[i] ?? "").trim());

  for (let r = 1; r < grid.length; r++) {
    const line = r + 1;
    const cells = grid[r]!;
    const level = at(cells, cols.level);
    const subject = at(cells, cols.subject);
    const start = at(cells, cols.start);
    const end = at(cells, cols.end);
    const weekday = parseWeekday(at(cells, cols.weekday));

    if (!level) { errors.push({ line, message: "Classe manquante" }); continue; }
    if (!subject) { errors.push({ line, message: "Matière manquante" }); continue; }
    if (weekday === null) { errors.push({ line, message: `Jour invalide : « ${at(cells, cols.weekday)} »` }); continue; }
    if (!TIME_RE.test(start)) { errors.push({ line, message: `Heure de début invalide : « ${start} »` }); continue; }
    if (!TIME_RE.test(end)) { errors.push({ line, message: `Heure de fin invalide : « ${end} »` }); continue; }
    if (toMinutes(end) <= toMinutes(start)) { errors.push({ line, message: "Fin avant ou égale au début" }); continue; }

    rows.push({
      level, weekday, startTime: start, endTime: end, subject,
      teacherName: at(cells, cols.teacher) || null,
      room: at(cells, cols.room) || null,
    });
  }
  return { columns: true, rows, errors };
}
