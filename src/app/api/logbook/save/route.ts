import { saveLogbookEntry } from "@/app/(app)/cahier-de-texte/actions";
import { replayRoute } from "@/core/application/replay-route";

// Cahier de texte rejouable hors-ligne. Create/update protégés par la clé d'idempotence.
export const POST = replayRoute((body) => saveLogbookEntry(body as never));
