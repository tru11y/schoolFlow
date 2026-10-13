"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Floating shortcut to the copilot. Hidden on the copilot pages themselves, where it would cover the chat input. */
export function CopilotFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/ai-assistant")) return null;
  return (
    <Link
      href="/ai-assistant"
      aria-label="Ouvrir le copilote IA"
      className="fixed bottom-5 right-5 z-20 grid size-14 place-items-center rounded-full bg-accent text-2xl text-canvas shadow-soft outline-none transition hover:scale-105 focus-visible:ring-4 focus-visible:ring-accent/40 active:scale-95"
    >
      <span aria-hidden>✨</span>
    </Link>
  );
}
