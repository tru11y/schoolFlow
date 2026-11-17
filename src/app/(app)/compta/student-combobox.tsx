"use client";

import { useId, useMemo, useRef, useState } from "react";

export interface ComboStudent {
  id: string;
  name: string;
  level: string;
}

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

const normalize = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Searchable single-select for students (name + class), keyboard-navigable, no dependency. */
export function StudentCombobox({
  students,
  value,
  onChange,
}: {
  students: ComboStudent[];
  value: string;
  onChange: (id: string) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = students.find((s) => s.id === value) ?? null;

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    const base = q
      ? students.filter((s) => normalize(`${s.name} ${s.level}`).includes(q))
      : students;
    return base.slice(0, 50);
  }, [students, query]);

  // When closed with a selection, show its name; while typing, show the query.
  const display = open ? query : selected ? `${selected.name}${selected.level ? ` · ${selected.level}` : ""}` : query;

  const commit = (s: ComboStudent) => {
    onChange(s.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Rechercher un élève (nom ou classe)…"
        value={display}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); if (value) onChange(""); }}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); commit(matches[active]!); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className={field}
      />
      {/* Carries the id to the form; required so the browser blocks an empty submit. */}
      <input type="hidden" name="studentId" value={value} required />

      {open ? (
        <ul
          id={listId}
          role="listbox"
          onMouseDown={() => blurTimer.current && clearTimeout(blurTimer.current)}
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl bg-surface p-1 shadow-soft ring-1 ring-ink/15"
        >
          {matches.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={s.id === value}
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(s)}
              className={`cursor-pointer rounded-xl px-3 py-2 text-sm ${i === active ? "bg-accent/15" : ""}`}
            >
              <span className="font-medium">{s.name}</span>
              {s.level ? <span className="text-ink/60"> · {s.level}</span> : null}
            </li>
          ))}
          {matches.length === 0 ? <li className="px-3 py-2 text-sm text-ink/60">Aucun élève trouvé.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
