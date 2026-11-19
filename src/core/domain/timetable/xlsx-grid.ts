import { TIME_RE, toMinutes } from "../students/timetable";
import { WEEKDAY_LABELS, parseWeekday, type ParsedSlot, type RowError } from "./import";

/**
 * Parsing de l'emploi du temps au format « grille » (le classeur Excel réel) :
 * chaque classe est un bloc titré « EMPLOI DU TEMPS <niveau> », suivi d'une ligne
 * d'en-tête « HORAIRES | LUNDI | … | DIMANCHE », puis de lignes horaires dont les
 * cellules contiennent la matière. Un bloc « 6E / 5E » alimente les deux niveaux.
 *
 * `grid` est la feuille en matrice dense (indexée 0), cellules fusionnées résolues
 * en haut-gauche (le reste à null) — ce que produit un lecteur xlsx standard.
 */

const DAY_INDEX = new Map<string, number>(); // libellé normalisé -> 1..7
for (let i = 0; i < WEEKDAY_LABELS.length; i++) {
  const w = parseWeekday(WEEKDAY_LABELS[i]!);
  if (w !== null) DAY_INDEX.set(WEEKDAY_LABELS[i]!.toUpperCase(), w);
}

const TIME_RANGE_RE = /^\s*(\d{1,2})H(\d{0,2})\s*-\s*(\d{1,2})H(\d{0,2})\s*$/i;

function parseTimeRange(label: string): { start: string; end: string } | null {
  const m = TIME_RANGE_RE.exec(label);
  if (!m) return null;
  const hhmm = (h: string, mm: string) => `${String(Number(h)).padStart(2, "0")}:${String(Number(mm || "0")).padStart(2, "0")}`;
  const start = hhmm(m[1]!, m[2]!);
  const end = hhmm(m[3]!, m[4]!);
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return null;
  if (toMinutes(end) <= toMinutes(start)) return null;
  return { start, end };
}

function normSubject(s: string): string {
  const up = s.trim().toUpperCase();
  return up === "FRANCAIS" ? "FRANÇAIS" : up;
}

function levelsFromTitle(title: string): string[] {
  const raw = title.replace(/^\s*EMPLOI DU TEMPS\s*/i, "");
  return raw
    .split("/")
    .map((p) => p.replace(/\s+/g, " ").trim().toUpperCase())
    .filter((p) => p.length > 0);
}

const cell = (grid: (string | null)[][], r: number, c: number): string =>
  (grid[r]?.[c] ?? "").toString().trim();

export function parseTimetableGrid(grid: (string | null)[][]): { columns: boolean; rows: ParsedSlot[]; errors: RowError[] } {
  // Localise les titres de bloc et leur colonne.
  const titles: { row: number; col: number; title: string }[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const v = cell(grid, r, c);
      if (/^EMPLOI DU TEMPS/i.test(v)) titles.push({ row: r, col: c, title: v });
    }
  }
  if (titles.length === 0) return { columns: false, rows: [], errors: [] };

  const rows: ParsedSlot[] = [];
  for (const { row: titleRow, col: titleCol, title } of titles) {
    const levels = levelsFromTitle(title);
    if (levels.length === 0) continue;

    // En-tête HORAIRES : première ligne sous le titre dont la colonne du titre vaut « HORAIRES ».
    let headerRow = -1;
    for (let r = titleRow + 1; r <= titleRow + 8 && r < grid.length; r++) {
      if (cell(grid, r, titleCol).toUpperCase() === "HORAIRES") { headerRow = r; break; }
    }
    if (headerRow === -1) continue;

    // Colonnes de jour depuis l'en-tête.
    const dayCols: { col: number; weekday: number }[] = [];
    for (let c = titleCol + 1; c <= titleCol + 8 && c < (grid[headerRow]?.length ?? 0); c++) {
      const w = DAY_INDEX.get(cell(grid, headerRow, c).toUpperCase());
      if (w !== undefined) dayCols.push({ col: c, weekday: w });
    }
    if (dayCols.length === 0) continue;

    // Fin du bloc : prochain titre dans la même colonne, borné à +15 lignes.
    const nextSameCol = titles
      .filter((t) => t.col === titleCol && t.row > titleRow)
      .reduce((min, t) => Math.min(min, t.row), Number.POSITIVE_INFINITY);
    const endRow = Math.min(Number.isFinite(nextSameCol) ? nextSameCol : headerRow + 16, headerRow + 16, grid.length);

    for (let r = headerRow + 1; r < endRow; r++) {
      const label = cell(grid, r, titleCol);
      if (!label || label.toUpperCase() === "PAUSE") continue;
      const tr = parseTimeRange(label);
      if (!tr) continue;
      for (const { col, weekday } of dayCols) {
        const raw = cell(grid, r, col);
        if (!raw) continue;
        const subject = normSubject(raw);
        for (const level of levels) {
          rows.push({ level, weekday, startTime: tr.start, endTime: tr.end, subject, teacherName: null, room: null });
        }
      }
    }
  }

  // Dédoublonnage en conservant l'ordre.
  const seen = new Set<string>();
  const uniq = rows.filter((s) => {
    const key = `${s.level}|${s.weekday}|${s.startTime}|${s.endTime}|${s.subject}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { columns: true, rows: uniq, errors: [] };
}
