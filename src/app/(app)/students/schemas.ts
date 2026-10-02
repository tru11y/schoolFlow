import { z } from "zod";
import { TIME_RE, toMinutes } from "@/core/domain/students/timetable";

export const text = (max: number) => z.string().trim().min(1).max(max);

const optional = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || undefined);

export const parentSchema = z
  .object({
    name: text(100),
    relation: text(40),
    phone: optional(30),
    email: optional(254).refine((v) => !v || z.email().safeParse(v).success, "E-mail invalide"),
  })
  .refine((p) => p.phone || p.email, { message: "Téléphone ou e-mail requis", path: ["phone"] });

export const parentsSchema = z.array(parentSchema).min(1).max(2);

export const slotSchema = z
  .object({
    id: z.string().uuid().optional(),
    studentId: z.string().uuid(),
    scope: z.enum(["class", "student"]),
    weekday: z.coerce.number().int().min(1).max(7),
    startTime: z.string().regex(TIME_RE),
    endTime: z.string().regex(TIME_RE),
    subject: text(60),
    teacherId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
    room: optional(30),
  })
  .refine((s) => toMinutes(s.endTime) > toMinutes(s.startTime), { message: "Fin avant début", path: ["endTime"] });
