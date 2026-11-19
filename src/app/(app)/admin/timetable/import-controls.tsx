"use client";

import { useRef, useState, useTransition } from "react";
import { importTimetable, importTimetableXlsx, type ImportSummary } from "./actions";

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export function ImportTimetable() {
  const [csv, setCsv] = useState("");
  const [xlsxB64, setXlsxB64] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    setFileName(file.name);
    const isXlsx = /\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml");
    const reader = new FileReader();
    if (isXlsx) {
      reader.onload = () => { setXlsxB64(toBase64(reader.result as ArrayBuffer)); setCsv(""); };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => { setCsv(String(reader.result ?? "")); setXlsxB64(null); };
      reader.readAsText(file, "utf-8");
    }
  };

  const submit = () =>
    start(async () => {
      setError(null);
      setSummary(null);
      const res = xlsxB64
        ? await importTimetableXlsx({ xlsxBase64: xlsxB64, replace })
        : await importTimetable({ csv, replace });
      if (res.ok) setSummary(res.data);
      else setError(res.error.code === "FORBIDDEN" ? "Fichier illisible : vérifiez le fichier (Excel au format grille, ou CSV avec colonnes Classe, Jour, Début, Fin, Matière)." : res.error.message);
    });

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
        className="grid gap-2 rounded-2xl border-2 border-dashed border-ink/20 p-4 text-sm"
      >
        <label className="font-medium">Fichier Excel (.xlsx) ou CSV</label>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
          className="text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-raised file:px-4 file:py-2 file:text-sm"
        />
        {fileName ? <p className="text-xs text-ink/70">Chargé : {fileName}{xlsxB64 ? " (Excel)" : ""}</p> : <p className="text-xs text-ink/60">Glissez-déposez votre .xlsx directement, ou collez le contenu CSV ci-dessous.</p>}
      </div>

      <label className="grid gap-1 text-sm">Ou coller le contenu CSV (depuis Excel, Ctrl+C sur les cellules)
        <textarea
          value={csv}
          onChange={(e) => { setCsv(e.target.value); setXlsxB64(null); setFileName(null); }}
          rows={6}
          placeholder={"Classe;Jour;Début;Fin;Matière;Enseignant;Salle\n6e;Lundi;08:00;10:00;Mathématiques;Jean Dupont;A1"}
          className={`${field} font-mono`}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="size-5 accent-[oklch(0.85_0.1_165)]" />
        Remplacer l&apos;emploi du temps existant des classes présentes dans le fichier
      </label>

      <button
        onClick={submit}
        disabled={pending || (csv.trim() === "" && !xlsxB64)}
        className="min-h-11 w-fit rounded-2xl bg-accent px-5 py-3 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-50"
      >
        {pending ? "Import en cours…" : "Importer"}
      </button>

      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

      {summary ? (
        <div className="grid gap-2 rounded-2xl bg-canvas p-4 text-sm">
          <p className="font-medium text-mint">{summary.created} créneau{summary.created > 1 ? "x" : ""} importé{summary.created > 1 ? "s" : ""}{summary.skipped ? ` · ${summary.skipped} ignoré${summary.skipped > 1 ? "s" : ""} (doublons)` : ""}.</p>
          {summary.unknownLevels.length ? (
            <p className="text-peach">Classes inconnues (lignes ignorées) : {summary.unknownLevels.join(", ")}. Créez-les dans « Niveaux ».</p>
          ) : null}
          {summary.unknownTeachers.length ? (
            <p className="text-peach">Enseignants introuvables (créneaux créés sans prof) : {summary.unknownTeachers.join(", ")}.</p>
          ) : null}
          {summary.errors.length ? (
            <div className="text-danger">
              <p className="font-medium">{summary.errors.length} ligne{summary.errors.length > 1 ? "s" : ""} en erreur :</p>
              <ul className="ml-4 list-disc">
                {summary.errors.slice(0, 20).map((e) => <li key={e.line}>Ligne {e.line} : {e.message}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
