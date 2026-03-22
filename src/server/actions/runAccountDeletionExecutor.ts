"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Intended to be called by a scheduled job (cron/edge function).
 * Deletes users whose execute_after is due and not cancelled/completed.
 */
export async function runAccountDeletionExecutor(limit = 50) {
  const admin = supabaseAdmin();

  const { data: due, error } = await admin
    .from("account_deletion_requests")
    .select("user_id, execute_after")
    .is("cancelled_at", null)
    .is("completed_at", null)
    .lte("execute_after", new Date().toISOString())
    .limit(limit);

  if (error) throw new Error(error.message);

  for (const r of due ?? []) {
    const uid = String((r as any).user_id);

    // delete auth user (profiles rows will cascade/delete depending on your FK setup)
    const del = await admin.auth.admin.deleteUser(uid);
    if (del.error) {
      // don't mark completed if delete fails
      continue;
    }

    await admin
      .from("account_deletion_requests")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", uid);
  }
}
