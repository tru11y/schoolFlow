import { z } from "zod";
import { CURRENCY_CODES } from "@/core/domain/finance/money";

/** Optional variables copied blank from .env.example must count as unset. */
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  AUDIT_HMAC_KEY: z.string().min(32),
  DEFAULT_CURRENCY: z.enum(CURRENCY_CODES).default("EUR"),
  // Optional lean-LLM layer of the copilot (everything else works without it).
  AI_PROVIDER: optional(z.enum(["anthropic", "openai"])),
  AI_API_KEY: optional(z.string().min(10)),
  AI_MODEL: optional(z.string().min(2)),
  /** Accepted as the key when AI_API_KEY is not set (implies AI_PROVIDER=anthropic). */
  ANTHROPIC_API_KEY: optional(z.string().min(10)),
  /** Needed only when the key is organization-level (not scoped to a workspace): sent as `anthropic-workspace-id`. */
  ANTHROPIC_WORKSPACE_ID: optional(z.string().min(5)),
  CRON_SECRET: optional(z.string().min(16)),
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
