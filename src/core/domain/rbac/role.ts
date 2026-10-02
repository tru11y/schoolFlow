export const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "school:manage",
  "user:manage",
  "finance:read",
  "finance:write",
  "receipt:issue",
  "attendance:read",
  "attendance:write",
  "homework:read",
  "homework:write",
  "chat:use",
  "audit:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  SUPER_ADMIN: new Set(PERMISSIONS),
  SCHOOL_ADMIN: new Set<Permission>([
    "user:manage", "finance:read", "attendance:read", "attendance:write",
    "homework:read", "homework:write", "chat:use", "audit:read",
  ]),
  ACCOUNTANT: new Set<Permission>(["finance:read", "finance:write", "receipt:issue", "chat:use"]),
  TEACHER: new Set<Permission>(["attendance:read", "attendance:write", "homework:read", "homework:write", "chat:use"]),
  STUDENT: new Set<Permission>(["attendance:read", "homework:read", "chat:use"]),
  PARENT: new Set<Permission>(["attendance:read", "homework:read", "finance:read", "chat:use"]),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Roles each role may open a chat with (default-deny). */
const CHAT_PEERS: Record<Role, ReadonlySet<Role>> = {
  SUPER_ADMIN: new Set(ROLES),
  SCHOOL_ADMIN: new Set(ROLES),
  ACCOUNTANT: new Set<Role>(["SCHOOL_ADMIN", "PARENT"]),
  TEACHER: new Set<Role>(["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"]),
  STUDENT: new Set<Role>(["TEACHER"]),
  PARENT: new Set<Role>(["TEACHER", "ACCOUNTANT", "SCHOOL_ADMIN"]),
};

export function canChat(from: Role, to: Role): boolean {
  return CHAT_PEERS[from].has(to);
}
