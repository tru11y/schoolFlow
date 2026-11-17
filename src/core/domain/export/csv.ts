/** RFC 4180 CSV. A field is quoted when it holds a delimiter, quote or newline. */
const escapeField = (value: string, delimiter: string): string =>
  new RegExp(`["\\n\\r${delimiter === ";" ? ";" : ","}]`).test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Cells starting with these characters are treated as formulas by Excel/Sheets. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

const render = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return FORMULA_PREFIX.test(s) ? `'${s}` : s;
};

/**
 * Builds a CSV document from a header row and data rows.
 * Uses `;` as the delimiter (Excel FR default) and prepends a UTF-8 BOM so accents
 * render correctly when the file is opened in Excel.
 */
export function toCsv(headers: readonly string[], rows: readonly unknown[][], delimiter = ";"): string {
  const line = (cells: readonly unknown[]) => cells.map((c) => escapeField(render(c), delimiter)).join(delimiter);
  const body = [headers, ...rows].map(line).join("\r\n");
  return `﻿${body}\r\n`;
}
