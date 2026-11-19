import { NextResponse } from "next/server";
import { takeAttendance } from "@/app/(app)/absences/take/actions";
import { claimKey, releaseKey } from "@/core/application/idempotency";

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

  // Garde anti-doublon : un item de la file ne doit être enregistré qu'une fois,
  // même si le flush en page et le Background Sync le rejouent en même temps.
  const key = req.headers.get("Idempotency-Key") ?? "";
  const fresh = await claimKey(key);
  if (!fresh) return NextResponse.json({ ok: true, data: { deduped: true } }, { status: 200 });

  try {
    const res = await takeAttendance(body as never);
    if (!res.ok) await releaseKey(key); // échec métier : on autorise un nouveau rejeu
    return NextResponse.json(res, { status: res.ok ? 200 : 422 });
  } catch (err) {
    await releaseKey(key);
    throw err;
  }
}
