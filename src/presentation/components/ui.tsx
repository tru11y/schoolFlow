"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Clock,
  CreditCard,
  GraduationCap,
  Hand,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Server components can't pass a component across the client boundary, so StatCard takes a key. */
const STAT_ICONS = {
  graduation: GraduationCap,
  hand: Hand,
  book: BookOpen,
  card: CreditCard,
  wallet: Wallet,
  receipt: Receipt,
  trending: TrendingUp,
  clock: Clock,
} as const;

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-ink/5 ${className}`}>{children}</section>;
}

const TONES = {
  mint: "bg-mint/15 text-mint",
  peach: "bg-peach/15 text-peach",
  sky: "bg-sky/15 text-sky",
  lilac: "bg-lilac/15 text-lilac",
} as const;

export function StatCard(props: {
  label: string;
  value: string;
  icon: keyof typeof STAT_ICONS;
  tone: keyof typeof TONES;
  index?: number;
  trend?: { value: number; label?: string };
  hint?: string;
}) {
  const Icon = STAT_ICONS[props.icon];
  const t = props.trend;
  const up = t ? t.value >= 0 : false;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (props.index ?? 0) * 0.06, type: "spring", stiffness: 260, damping: 24 }}
      whileHover={{ y: -3 }}
      className="rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-ink/5"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className={`grid size-11 place-items-center rounded-2xl ${TONES[props.tone]}`} aria-hidden>
          <Icon className="size-5" strokeWidth={2} />
        </div>
        {t ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium tabular-nums ${up ? "bg-mint/15 text-mint" : "bg-danger/15 text-danger"}`}
          >
            {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {up ? "+" : ""}
            {t.value}
            {t.label ?? "%"}
          </span>
        ) : null}
      </div>
      <p className="text-3xl font-semibold tabular-nums">{props.value}</p>
      <p className="mt-1 text-sm text-ink/70">{props.label}</p>
      {props.hint ? <p className="mt-0.5 text-xs text-ink/50">{props.hint}</p> : null}
    </motion.div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-ink/70">{subtitle}</p> : null}
    </header>
  );
}

const BADGES = {
  success: "bg-mint/15 text-mint",
  warning: "bg-peach/15 text-peach",
  danger: "bg-danger/15 text-danger",
  info: "bg-sky/15 text-sky",
  neutral: "bg-ink/10 text-ink/70",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof BADGES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${BADGES[tone]}`}>
      {children}
    </span>
  );
}

const BTN_VARIANTS = {
  primary: "bg-accent text-surface hover:brightness-110 shadow-soft",
  ghost: "bg-surface ring-1 ring-ink/15 hover:bg-raised",
  danger: "bg-danger text-surface hover:brightness-110",
} as const;

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BTN_VARIANTS }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${BTN_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-ink/10 ${className}`} />;
}

/** Minimal bar chart for a short numeric series (0–100 scale by default). */
export function MiniBars({
  data,
  tone = "accent",
  max = 100,
  className = "",
}: {
  data: { label: string; value: number }[];
  tone?: "accent" | "mint" | "peach" | "sky" | "lilac";
  max?: number;
  className?: string;
}) {
  const barColor = {
    accent: "bg-accent/80",
    mint: "bg-mint/80",
    peach: "bg-peach/80",
    sky: "bg-sky/80",
    lilac: "bg-lilac/80",
  }[tone];
  return (
    <div className={`flex items-end gap-2 ${className}`} role="img" aria-label="Graphique">
      {data.map((d, i) => {
        const h = Math.max(4, Math.round((d.value / max) * 100));
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end justify-center">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: i * 0.05, type: "spring", stiffness: 160, damping: 22 }}
                className={`w-full max-w-9 rounded-t-lg ${barColor}`}
                title={`${d.label}: ${d.value}`}
              />
            </div>
            <span className="truncate text-[11px] text-ink/60">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
