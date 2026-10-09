import type { CompetitorView } from "./competitors";

export interface Contact {
  name: string;
  phone: string | null;
  email: string | null;
}

export interface StudentArrear {
  studentId: string;
  studentName: string;
  level: string;
  owedCents: number;
  oldestDue: Date;
  parent: Contact | null;
}

export interface StudentAbsenceFlag {
  studentId: string;
  studentName: string;
  level: string;
  absences: number;
  lates: number;
  parent: Contact | null;
}

export interface TeacherPunctuality {
  teacherId: string;
  teacherName: string;
  expectedSessions: number;
  missedRollCalls: number;
  lateRollCalls: number;
  missingLogbook: number;
}

export interface LevelSize {
  level: string;
  students: number;
  /** Configured monthly fee (minor units), when known */
  feeCents?: number | null;
}

export interface CopilotSnapshot {
  schoolName: string;
  currency: string;
  arrears: StudentArrear[];
  upcoming: StudentArrear[];
  absences: StudentAbsenceFlag[];
  teachers: TeacherPunctuality[];
  levels: LevelSize[];
  /** Competitors entered by the SUPER_ADMIN */
  competitors?: CompetitorView[];
}

export type CardCategory = "FINANCE" | "DISCIPLINE" | "PEDAGOGY" | "GROWTH";

export interface ActionLink {
  label: string;
  kind: "whatsapp" | "sms" | "email" | "page";
  href: string;
}

export interface ActionCard {
  id: string;
  category: CardCategory;
  /** 1 = urgent, 3 = routine */
  priority: 1 | 2 | 3;
  title: string;
  detail: string;
  links: ActionLink[];
}
