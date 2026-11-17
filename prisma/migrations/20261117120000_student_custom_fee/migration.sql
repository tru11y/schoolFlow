-- Per-student monthly tuition override (minor units); null falls back to the level fee.
ALTER TABLE "student_profiles" ADD COLUMN "monthlyFeeCents" INTEGER;
