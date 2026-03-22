import { redirect } from "next/navigation";
import { getProfile } from "./getProfile";

type Role = "admin" | "supplier" | "customer";
type Scope = "public" | "member" | "admin" | "supplier" | "customer";

function homeFor(role: Role) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "supplier") return "/supplier/dashboard";
  return "/market";
}

export async function requireAccess(scope: Scope) {
  const { user, profile } = await getProfile();

  if (!user) redirect("/login");
  if (!profile) redirect("/pending");

  if (profile.status === "pending") redirect("/pending");

  const role = profile.role as Role | null;
  if (!role) redirect("/pending");

  if (scope === "member") return { user, profile };

  if (scope === "admin") {
    if (role !== "admin") redirect(homeFor(role));
    return { user, profile };
  }

  if (scope === "supplier") {
    if (role !== "supplier") redirect(homeFor(role));
    return { user, profile };
  }

  if (scope === "customer") {
    if (role !== "customer") redirect(homeFor(role));
    return { user, profile };
  }

  return { user, profile };
}
