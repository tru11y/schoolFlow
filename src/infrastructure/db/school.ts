import { isCurrency, type CurrencyCode } from "@/core/domain/finance/money";
import { prisma } from "./prisma";

/** Currency configured for the school (amounts are stored in its minor units). */
export async function getSchoolCurrency(schoolId: string | null): Promise<CurrencyCode> {
  if (!schoolId) return "EUR";
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { currency: true } });
  return school && isCurrency(school.currency) ? school.currency : "EUR";
}
