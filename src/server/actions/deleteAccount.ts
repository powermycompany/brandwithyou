"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Schedules deletion 30 days from now by writing to public.account_deletion_requests.
 * Does NOT hard-delete the auth user.
 */
export async function requestAccountDeletion(formData: FormData) {
  const confirm = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (confirm !== "DELETE") throw new Error("Type DELETE to confirm");

  const supabase = await supabaseServer();
  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const executeAfter = addDaysISO(30);

  // upsert request
  const { error } = await supabase
    .from("account_deletion_requests")
    .upsert(
      {
        user_id: uid,
        execute_after: executeAfter,
        cancelled_at: null,
        completed_at: null,
      } as any,
      { onConflict: "user_id" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/customer/profile");
  revalidatePath("/supplier/profile");
}

/**
 * Cancels a scheduled deletion.
 */
export async function cancelAccountDeletion(_formData: FormData) {
  const supabase = await supabaseServer();
  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("account_deletion_requests")
    .update({
      cancelled_at: new Date().toISOString(),
    } as any)
    .eq("user_id", uid)
    .is("completed_at", null);

  if (error) throw new Error(error.message);

  revalidatePath("/customer/profile");
  revalidatePath("/supplier/profile");
}
