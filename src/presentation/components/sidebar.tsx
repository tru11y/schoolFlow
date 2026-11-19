"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  CreditCard,
  Flag,
  GraduationCap,
  Hand,
  Home,
  Library,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ICONS: Record<string, LucideIcon> = {
  dashboard: Home,
  copilot: Sparkles,
  competitors: Flag,
  students: GraduationCap,
  compta: CreditCard,
  logbook: BookOpen,
  curriculum: Library,
  absences: Hand,
  users: Users,
  trash: Trash2,
  levels: Tag,
  timetable: Calendar,
  settings: Settings,
  audit: ShieldCheck,
};

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

function NavLinks({ items, activeHref, onNavigate }: { items: NavItem[]; activeHref?: string; onNavigate?: () => void }) {
  return (
    <>
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = ICONS[item.icon] ?? Home;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${active ? "text-accent" : "text-ink/75 hover:bg-raised hover:text-ink"}`}
          >
            {active ? (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-2xl bg-accent/15 ring-1 ring-accent/30"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <Icon className="relative size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function Brand({ schoolName, hasLogo }: { schoolName: string; hasLogo: boolean }) {
  return (
    <span className="flex items-center gap-3 text-base font-semibold leading-tight">
      {hasLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- auth-gated route, not optimizable
        <img src="/school-logo" alt="" className="size-9 shrink-0 rounded-xl object-contain" />
      ) : (
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-surface shadow-soft">
          <GraduationCap className="size-5" />
        </span>
      )}
      <span className="min-w-0 break-words">{schoolName}</span>
    </span>
  );
}

export function Sidebar({ items, schoolName, hasLogo }: { items: NavItem[]; schoolName: string; hasLogo: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Longest matching href wins, so /ai-assistant/competitors does not also light up /ai-assistant.
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((x, y) => y.href.length - x.href.length)[0]?.href;

  // Close the drawer on route change and lock body scroll while open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Desktop: fixed vertical sidebar */}
      <nav
        data-chrome
        aria-label="Navigation principale"
        className="hidden border-ink/5 bg-surface p-4 md:flex md:w-64 md:shrink-0 md:flex-col md:gap-1.5 md:border-r"
      >
        <div className="px-2 pb-5 pt-2">
          <Brand schoolName={schoolName} hasLogo={hasLogo} />
        </div>
        <NavLinks items={items} activeHref={activeHref} />
      </nav>

      {/* Mobile: compact bar with hamburger */}
      <div
        data-chrome
        className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink/5 bg-surface px-4 py-3 md:hidden"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={open}
          className="grid size-10 place-items-center rounded-2xl ring-1 ring-ink/10 outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
        >
          <Menu className="size-5" />
        </button>
        <Brand schoolName={schoolName} hasLogo={hasLogo} />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.nav
              aria-label="Navigation principale"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute inset-y-0 left-0 flex w-[82%] max-w-80 flex-col gap-1.5 overflow-y-auto bg-surface p-4 shadow-soft"
            >
              <div className="mb-3 flex items-center justify-between px-2 pt-1">
                <Brand schoolName={schoolName} hasLogo={hasLogo} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer le menu"
                  className="grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-ink/10 outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                >
                  <X className="size-5" />
                </button>
              </div>
              <NavLinks items={items} activeHref={activeHref} onNavigate={() => setOpen(false)} />
            </motion.nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
