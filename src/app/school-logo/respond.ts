import { createHash } from "node:crypto";
import { decodeLogoDataUrl } from "@/core/domain/school/logo";

export function logoResponse(req: Request, dataUrl: string | null | undefined): Response {
  const logo = dataUrl ? decodeLogoDataUrl(dataUrl) : null;
  if (!logo) return new Response("Not found", { status: 404 });

  const etag = `"${createHash("sha1").update(logo.bytes).digest("hex")}"`;
  const headers = { ETag: etag, "Cache-Control": "private, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(logo.bytes), { headers: { ...headers, "Content-Type": logo.mime } });
}
