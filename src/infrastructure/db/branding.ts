import { DEFAULT_WELCOME_MESSAGE, type LoginBranding } from "@/core/domain/school/branding";
import { prisma } from "./prisma";

const FALLBACK_YEAR = "2026 - 2027";

/**
 * Public branding for the login page. SchoolFlow runs one establishment per deployment,
 * so the oldest school is used. Nothing here is sensitive.
 */
export async function getLoginBranding(): Promise<LoginBranding> {
  const school = await prisma.school
    .findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { name: true, logoDataUrl: true, academicYear: true, welcomeMessage: true },
    })
    // The login page must still render if the database is unreachable.
    .catch(() => null);

  return {
    name: school?.name ?? "SchoolFlow",
    hasLogo: Boolean(school?.logoDataUrl),
    academicYear: school?.academicYear ?? FALLBACK_YEAR,
    welcomeMessage: school?.welcomeMessage?.trim() || DEFAULT_WELCOME_MESSAGE,
  };
}
