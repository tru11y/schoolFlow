import { randomBytes } from "node:crypto";

/** Jeton de partage public, URL-safe, non devinable (192 bits). */
export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
