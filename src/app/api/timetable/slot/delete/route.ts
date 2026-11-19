import { deleteSlot } from "@/app/(app)/students/actions";
import { replayRoute } from "@/core/application/replay-route";

// Suppression d'un créneau d'emploi du temps, rejouable hors-ligne.
export const POST = replayRoute((body) => deleteSlot(body as never));
