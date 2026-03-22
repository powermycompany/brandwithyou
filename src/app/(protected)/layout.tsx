import AppShell from "@/components/layout/AppShell";
import { requireAccess } from "@/server/queries/requireAccess";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAccess("member");

  const role = profile.role;

  const variant =
    role === "admin"
      ? "admin"
      : role === "supplier"
      ? "supplier"
      : "customer";

  const title =
    role === "admin"
      ? "Admin"
      : role === "supplier"
      ? "Supplier"
      : "Customer";

  return (
    <AppShell title={title} variant={variant}>
      {children}
    </AppShell>
  );
}
