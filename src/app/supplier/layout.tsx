import AppShell from "@/components/layout/AppShell";
import { requireAccess } from "@/server/queries/requireAccess";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  await requireAccess("supplier");
  return <AppShell title="Supplier" variant="supplier">{children}</AppShell>;
}
