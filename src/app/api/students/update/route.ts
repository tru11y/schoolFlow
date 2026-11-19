import { updateStudent } from "@/app/(app)/students/actions";
import { replayRoute } from "@/core/application/replay-route";

// Modification élève rejouable hors-ligne (updates idempotents + clé d'idempotence).
export const POST = replayRoute((body) => updateStudent(body as never));
