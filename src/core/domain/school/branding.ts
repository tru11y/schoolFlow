import { z } from "zod";

export const DEFAULT_WELCOME_MESSAGE = "Bienvenue sur votre espace d'accompagnement et de cours de renforcement.";

/** Normalizes an empty / blank announcement to null (the default message is then shown). */
export const welcomeMessageSchema = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null);

export interface LoginBranding {
  name: string;
  hasLogo: boolean;
  /** "2026 - 2027" */
  academicYear: string;
  welcomeMessage: string;
}
