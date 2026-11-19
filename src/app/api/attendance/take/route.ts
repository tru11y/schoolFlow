import { takeAttendance } from "@/app/(app)/absences/take/actions";
import { replayRoute } from "@/core/application/replay-route";

// Prise d'absences rejouable hors-ligne. Upserts idempotents → rejeu sûr.
export const POST = replayRoute((body) => takeAttendance(body as never));
