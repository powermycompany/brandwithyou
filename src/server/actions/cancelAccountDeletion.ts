"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function cancelAccountDeletion() {
  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("account_deletion_requests")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("user_id", uid)
    .is("completed_at", null);

  if (error) throw new Error(error.message);

  revalidatePath("/supplier/profile");
  revalidatePath("/customer/profile");
}
