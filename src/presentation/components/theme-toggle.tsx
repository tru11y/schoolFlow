"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      className="grid size-10 place-items-center rounded-2xl bg-surface outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
    >
      {mounted ? (isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />) : <span className="size-[18px]" />}
    </button>
  );
}
