import { createHmac } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(",")}}`;
}

export function computeHash(key: string, prevHash: string, payload: unknown): string {
  return createHmac("sha256", key).update(prevHash).update(canonicalize(payload)).digest("hex");
}
