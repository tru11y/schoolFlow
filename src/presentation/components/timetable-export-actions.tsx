"use client";

import { useState } from "react";

const btn =
  "inline-flex min-h-10 items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:opacity-60";

/** Actions d'export côté client : impression (PDF) et capture PNG d'un élément. */
export function TimetableExportActions({
  captureId,
  fileBase,
  icsHref,
  csvHref,
}: {
  captureId: string;
  fileBase: string;
  icsHref?: string;
  csvHref?: string;
}) {
  const [busy, setBusy] = useState(false);

  const png = async () => {
    const node = document.getElementById(captureId);
    if (!node) return;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const url = await toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className={btn}>
        <span aria-hidden>🖨️</span> Imprimer / PDF
      </button>
      <button type="button" onClick={png} disabled={busy} className={btn}>
        <span aria-hidden>🖼️</span> {busy ? "…" : "Image PNG"}
      </button>
      {icsHref ? (
        <a href={icsHref} className={btn}>
          <span aria-hidden>📅</span> Agenda (.ics)
        </a>
      ) : null}
      {csvHref ? (
        <a href={csvHref} download className={btn}>
          <span aria-hidden>⬇️</span> CSV
        </a>
      ) : null}
    </div>
  );
}
