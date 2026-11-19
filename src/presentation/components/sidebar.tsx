"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  CreditCard,
  Flag,
  GraduationCap,
  Hand,
  Home,
  Library,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function Sidebar({ items, schoolName, hasLogo }: { items: NavItem[]; schoolName: string; hasLogo: boolean }) {
  const pathname = usePathname();
  // Longest matching href wins, so /ai-assistant/competitors does not also light up /ai-assistant.
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((x, y) => y.href.length - x.href.length)[0]?.href;
  return (
    <nav
      data-chrome
      aria-label="Navigation principale"
      className="flex gap-1.5 overflow-x-auto border-ink/5 bg-surface p-3 md:w-64 md:shrink-0 md:flex-col md:overflow-visible md:border-r md:p-4"
    >
      <p className="hidden items-center gap-3 px-2 pb-5 pt-2 text-base font-semibold leading-tight md:flex">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- auth-gated route, not optimizable
          <img src="/school-logo" alt="" className="size-9 shrink-0 rounded-xl object-contain" />
        ) : (
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-surface shadow-soft"
          >
            <GraduationCap className="size-5" />
          </span>
        )}
        <span className="min-w-0 break-words">{schoolName}</span>
      </p>
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = ICONS[item.icon] ?? Home;
        return (
          <Link
            key={item.href}
            href={item.href}
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
    </nav>
  );
}
