export const REDACTED = "[REDACTED]";

const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|authorization|cookie|api[-_]?key|private[-_]?key|credential|session|otp|pin|cvv|iban|card[-_]?number|signature|hmac/i;

const SENSITIVE_VALUE: readonly RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, // JWT
  /\b(?:\d[ -]?){13,19}\b/g, // PAN
  /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?\b/g, // IBAN
];

const MAX_DEPTH = 8;
const MAX_STRING = 2_000;

function scrubString(value: string): string {
  let out = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  for (const re of SENSITIVE_VALUE) out = out.replace(re, REDACTED);
  return out;
}

export function sanitize(input: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return scrubString(input);
  if (typeof input === "number" || typeof input === "boolean") return input;
  if (typeof input === "bigint") return input.toString();
  if (input instanceof Date) return input.toISOString();
  if (typeof input !== "object") return undefined;
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (seen.has(input)) return "[CIRCULAR]";
  seen.add(input);

  if (Array.isArray(input)) return input.map((v) => sanitize(v, depth + 1, seen));

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitize(value, depth + 1, seen);
  }
  return out;
}
