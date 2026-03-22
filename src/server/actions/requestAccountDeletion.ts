"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function requestAccountDeletion(formData: FormData) {
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "DELETE") throw new Error("Type DELETE to confirm");

  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const executeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // idempotent: if already requested and not cancelled/completed, keep existing
  const { data: existing, error: exErr } = await supabase
    .from("account_deletion_requests")
    .select("user_id, cancelled_at, completed_at")
    .eq("user_id", uid)
    .maybeSingle();

  if (exErr) throw new Error(exErr.message);

  if (existing && !existing.cancelled_at && !existing.completed_at) {
    revalidatePath("/supplier/profile");
    revalidatePath("/customer/profile");
    return;
  }

  const { error } = await supabase.from("account_deletion_requests").upsert({
    user_id: uid,
    requested_at: new Date().toISOString(),
    execute_after: executeAfter,
    cancelled_at: null,
    completed_at: null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/supplier/profile");
  revalidatePath("/customer/profile");
}
