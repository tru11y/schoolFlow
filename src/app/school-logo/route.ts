import { createHash } from "node:crypto";
import { decodeLogoDataUrl } from "@/core/domain/school/logo";
import { prisma } from "@/infrastructure/db/prisma";
import { getPrincipal } from "@/presentation/auth/guards";

export async function GET(req: Request) {
  const principal = await getPrincipal();
  if (!principal?.schoolId) return new Response("Not found", { status: 404 });

  const school = await prisma.school.findUnique({ where: { id: principal.schoolId }, select: { logoDataUrl: true } });
  const logo = school?.logoDataUrl ? decodeLogoDataUrl(school.logoDataUrl) : null;
  if (!logo) return new Response("Not found", { status: 404 });

  const etag = `"${createHash("sha1").update(logo.bytes).digest("hex")}"`;
  const headers = { ETag: etag, "Cache-Control": "private, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(logo.bytes), { headers: { ...headers, "Content-Type": logo.mime } });
}
