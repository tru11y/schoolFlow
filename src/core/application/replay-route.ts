import { NextResponse } from "next/server";
import { claimKey, releaseKey } from "./idempotency";

type ActionLike = (body: unknown) => Promise<{ ok: boolean }>;

/**
 * Transforme une Server Action en route POST rejouable depuis la file hors-ligne.
 * Toute la logique (auth, autorisations, audit, Zod) reste celle de l'action.
 * La garde d'idempotence (header `Idempotency-Key`) empêche un double
 * enregistrement quand le flush en page et le Background Sync rejouent en parallèle.
 */
export function replayRoute(action: ActionLike) {
  return async function POST(req: Request) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: { message: "invalid-json" } }, { status: 400 });
    }

    const key = req.headers.get("Idempotency-Key") ?? "";
    const fresh = await claimKey(key);
    if (!fresh) return NextResponse.json({ ok: true, data: { deduped: true } }, { status: 200 });

    try {
      const res = await action(body);
      if (!res.ok) await releaseKey(key); // rejet métier : on autorise un nouveau rejeu
      return NextResponse.json(res, { status: res.ok ? 200 : 422 });
    } catch (err) {
      await releaseKey(key);
      throw err;
    }
  };
}
