import { prisma } from "@/infrastructure/db/prisma";
import { logoResponse } from "../respond";

/** Public branding for the login page (single-school deployment: the first active school). */
export async function GET(req: Request) {
  const school = await prisma.school.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: { logoDataUrl: true } });
  return logoResponse(req, school?.logoDataUrl);
}
