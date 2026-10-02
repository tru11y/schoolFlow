// Regenerates the initial migration: Prisma-generated DDL + audit immutability triggers.
// Usage: node scripts/build-migration.mjs   (offline, no database needed)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = "prisma/migrations/20260101000000_init";
mkdirSync(dir, { recursive: true });

const ddl = execFileSync(
  "npx",
  ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
  { encoding: "utf8", shell: true },
);
const triggers = readFileSync("prisma/sql/audit_immutable.sql", "utf8");

writeFileSync(`${dir}/migration.sql`, `${ddl}\n-- Audit immutability\n${triggers}`);
writeFileSync("prisma/migrations/migration_lock.toml", 'provider = "postgresql"\n');
console.log(`Wrote ${dir}/migration.sql`);
