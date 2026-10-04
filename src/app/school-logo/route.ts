import { prisma } from "@/infrastructure/db/prisma";
import { getPrincipal } from "@/presentation/auth/guards";
import { logoResponse } from "./respond";

export async function GET(req: Request) {
  const principal = await getPrincipal();
  if (!principal?.schoolId) return new Response("Not found", { status: 404 });
  const school = await prisma.school.findUnique({ where: { id: principal.schoolId }, select: { logoDataUrl: true } });
  return logoResponse(req, school?.logoDataUrl);
}
