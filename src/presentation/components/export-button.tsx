/**
 * Download link for a CSV export. Points at `/api/export/<resource>`, forwarding the
 * current filters as query params. Plain anchor with `download` — no client JS needed.
 */
export function ExportButton({
  resource,
  params,
  label = "Exporter CSV",
}: {
  resource: string;
  params?: Record<string, string | undefined>;
  label?: string;
}) {
  const search = new URLSearchParams(
    Object.entries(params ?? {}).filter((e): e is [string, string] => Boolean(e[1])),
  );
  const href = `/api/export/${resource}${search.size ? `?${search}` : ""}`;
  return (
    <a
      href={href}
      download
      className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-surface px-5 py-3 text-sm font-medium outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
    >
      <span aria-hidden>⬇️</span>
      {label}
    </a>
  );
}
