"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export function Sidebar({ items, schoolName, hasLogo }: { items: NavItem[]; schoolName: string; hasLogo: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="flex gap-2 overflow-x-auto bg-surface p-3 md:w-64 md:shrink-0 md:flex-col md:overflow-visible md:p-5"
    >
      <p className="hidden items-center gap-3 px-3 pb-4 pt-2 text-lg font-semibold leading-tight md:flex">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- auth-gated route, not optimizable
          <img src="/school-logo" alt="" className="size-9 shrink-0 rounded-xl object-contain" />
        ) : (
          <span aria-hidden>🎒</span>
        )}
        <span className="min-w-0 break-words">{schoolName}</span>
      </p>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="relative flex items-center gap-3 whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent"
          >
            {active ? (
              <motion.span
                layoutId="nav-pill"
                className="absolute inset-0 rounded-2xl bg-accent/20 ring-1 ring-accent/40"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative" aria-hidden>{item.icon}</span>
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
