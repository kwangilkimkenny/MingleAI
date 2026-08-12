const PRIVILEGED_ROLES = new Set(["admin", "super_admin"]);

/** Roles allowed to operate without consumer identity verification. Fail closed for unknown roles. */
export function isPrivilegedRole(role: string): boolean {
  return PRIVILEGED_ROLES.has(role);
}
