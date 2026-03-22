import AppShell from "@/components/layout/AppShell";
import { requireAccess } from "@/server/queries/requireAccess";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAccess("admin");
  return <AppShell title="Admin" variant="admin">{children}</AppShell>;
}
