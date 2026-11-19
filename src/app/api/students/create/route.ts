import { createStudent } from "@/app/(app)/students/actions";
import { replayRoute } from "@/core/application/replay-route";

// Inscription élève rejouable hors-ligne. La clé d'idempotence empêche un doublon
// au rejeu. Note : identifiant + mot de passe temporaire sont générés à la synchro
// et ne sont donc pas affichés pour une création faite hors-ligne.
export const POST = replayRoute((body) => createStudent(body as never));
