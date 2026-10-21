export const TRASH_KINDS = ["user", "chapter", "logbook", "attendance", "competitor"] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];
