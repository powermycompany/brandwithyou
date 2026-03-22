"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function sendChatMessage(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!threadId) throw new Error("thread_id missing");
  if (!body) throw new Error("message is empty");
  if (body.length > 4000) throw new Error("message too long");

  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { error } = await supabase.from("chat_messages").insert({
    thread_id: threadId,
    sender_id: uid,
    body,
  });

  if (error) throw new Error(error.message);

  // Revalidate both role pages (safe; whichever exists will refresh)
  revalidatePath("/supplier/messages");
  revalidatePath("/customer/messages");
  revalidatePath(`/supplier/messages/${threadId}`);
  revalidatePath(`/customer/messages/${threadId}`);
}
