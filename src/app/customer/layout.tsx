import AppShell from "@/components/layout/AppShell";
import { requireAccess } from "@/server/queries/requireAccess";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await requireAccess("customer");
  return <AppShell title="Customer" variant="customer">{children}</AppShell>;
}
