import { ForbiddenError } from "@/core/domain/errors";
import { prisma } from "@/infrastructure/db/prisma";
import { requirePermission } from "@/presentation/auth/guards";
import type { Principal } from "@/core/domain/auth/principal";

/** Download a frozen end-of-month collection sheet by id (scoped to the caller's school). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let principal: Principal;
  try {
    principal = await requirePermission("finance:write");
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw err;
  }

  if (!principal.schoolId) return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  const sheet = await prisma.collectionSheet.findFirst({
    where: { id, schoolId: principal.schoolId },
    select: { period: true, csv: true },
  });
  if (!sheet) return new Response("Not found", { status: 404 });

  return new Response(sheet.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="encaissement-${sheet.period}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
