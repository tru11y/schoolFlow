import { NextResponse } from "next/server";
import { takeAttendance } from "@/app/(app)/absences/take/actions";

/**
 * Endpoint rejouable pour la prise d'absences hors-ligne : la file d'attente
 * (outbox IndexedDB) rejoue ce POST au retour du réseau. Toute la logique
 * (auth, autorisations, audit, validation Zod) est celle de la Server Action —
 * aucune duplication. Les upserts sous-jacents sont idempotents : rejouer est sûr.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { message: "invalid-json" } }, { status: 400 });
  }

  const res = await takeAttendance(body as never);
  return NextResponse.json(res, { status: res.ok ? 200 : 422 });
}
