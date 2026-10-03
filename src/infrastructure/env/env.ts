import { z } from "zod";
import { CURRENCY_CODES } from "@/core/domain/finance/money";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  AUDIT_HMAC_KEY: z.string().min(32),
  DEFAULT_CURRENCY: z.enum(CURRENCY_CODES).default("EUR"),
  CRON_SECRET: z.string().min(16).optional(),
  APP_URL: z.string().url(),
  AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOGIN_IP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(30),
  AUTH_LOGIN_WINDOW_SEC: z.coerce.number().int().positive().default(900),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}
