export type UserRole = "admin" | "supplier" | "customer";
export type UserStatus = "pending" | "active";

export function isAllowedRole(role: string | null | undefined): role is UserRole {
  return role === "admin" || role === "supplier" || role === "customer";
}

export function isAllowedStatus(status: string | null | undefined): status is UserStatus {
  return status === "pending" || status === "active";
}
