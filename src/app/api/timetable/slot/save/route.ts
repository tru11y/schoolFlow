import { saveSlot } from "@/app/(app)/students/actions";
import { replayRoute } from "@/core/application/replay-route";

// Enregistrement d'un créneau d'emploi du temps, rejouable hors-ligne.
export const POST = replayRoute((body) => saveSlot(body as never));
