import { z } from "zod";

export const MAX_LOGO_BYTES = 150 * 1024;

export interface DecodedLogo {
  mime: "image/png" | "image/jpeg";
  bytes: Buffer;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Buffer, sig: number[]) => sig.every((b, i) => bytes[i] === b);

/** Decodes a `data:image/(png|jpeg);base64,…` URL; checks size and magic bytes (never trusts the declared mime). */
export function decodeLogoDataUrl(dataUrl: string): DecodedLogo | null {
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[2]!, "base64");
  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
  if (m[1] === "png") return startsWith(bytes, PNG_SIGNATURE) ? { mime: "image/png", bytes } : null;
  return startsWith(bytes, JPEG_SIGNATURE) ? { mime: "image/jpeg", bytes } : null;
}

/** undefined keeps the current logo, null removes it. */
export const logoDataUrlSchema = z
  .string()
  .max(Math.ceil((MAX_LOGO_BYTES * 4) / 3) + 64)
  .refine((v) => decodeLogoDataUrl(v) !== null, "invalid-logo")
  .nullable()
  .optional();
