"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-surface p-6 shadow-soft ${className}`}>{children}</section>;
}

const TONES = {
  mint: "bg-mint/15 text-mint",
  peach: "bg-peach/15 text-peach",
  sky: "bg-sky/15 text-sky",
  lilac: "bg-lilac/15 text-lilac",
} as const;

export function StatCard(props: { label: string; value: string; icon: string; tone: keyof typeof TONES; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (props.index ?? 0) * 0.06, type: "spring", stiffness: 260, damping: 24 }}
      whileHover={{ y: -3 }}
      className="rounded-3xl bg-surface p-5 shadow-soft"
    >
      <div className={`mb-4 grid size-11 place-items-center rounded-2xl text-xl ${TONES[props.tone]}`} aria-hidden>
        {props.icon}
      </div>
      <p className="text-3xl font-semibold tabular-nums">{props.value}</p>
      <p className="mt-1 text-sm text-ink/70">{props.label}</p>
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
  danger: "bg-red-400/15 text-red-300",
  info: "bg-sky/15 text-sky",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof BADGES; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${BADGES[tone]}`}>{children}</span>;
}
