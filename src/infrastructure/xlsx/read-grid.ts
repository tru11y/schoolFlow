import ExcelJS from "exceljs";

export interface SheetGrid {
  name: string;
  grid: (string | null)[][];
}

/** Lit un .xlsx en matrices denses (indexées 0), une par feuille. Cellules
 *  fusionnées résolues en haut-gauche (le reste à null). */
export async function readSheetsAsGrids(buffer: Buffer): Promise<SheetGrid[]> {
  const wb = new ExcelJS.Workbook();
  // Le type de Buffer d'exceljs diffère de @types/node ; cast local sans effet runtime.
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const sheets: SheetGrid[] = [];
  wb.eachSheet((ws) => {
    // getSheetValues : tableau 1-indexé [row][col]; les fusions ne portent qu'en haut-gauche.
    const values = ws.getSheetValues() as unknown[];
    const grid: (string | null)[][] = [];
    for (let r = 1; r < values.length; r++) {
      const srcRow = (values[r] as unknown[]) ?? [];
      const outRow: (string | null)[] = [];
      for (let c = 1; c < srcRow.length; c++) {
        const v = srcRow[c];
        outRow.push(v == null ? null : cellText(v));
      }
      grid.push(outRow);
    }
    sheets.push({ name: ws.name, grid });
  });
  return sheets;
}

/** Texte d'une cellule exceljs (gère valeurs riches / formules / hyperliens). */
function cellText(v: unknown): string {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (typeof o.result === "string" || typeof o.result === "number") return String(o.result);
    if (Array.isArray(o.richText)) return o.richText.map((p) => (p as { text?: string }).text ?? "").join("");
    if (o.hyperlink && typeof o.text === "string") return o.text;
  }
  return "";
}
