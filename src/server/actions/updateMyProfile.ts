"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function clean(s: any) {
  const v = String(s ?? "").trim();
  return v.length ? v : null;
}

export async function updateMyProfile(formData: FormData) {
  const full_name = clean(formData.get("full_name"));
  const account_name = clean(formData.get("account_name"));
  const phone = clean(formData.get("phone"));
  const country = clean(formData.get("country"));
  const preferred_language = clean(formData.get("preferred_language")) ?? "en";

  if (!full_name) throw new Error("full_name required");
  if (!account_name) throw new Error("account_name required");

  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);

  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name,
      account_name,
      phone,
      country,
      preferred_language,
      updated_at: new Date().toISOString(),
    })
    .eq("id", uid);

  if (error) throw new Error(error.message);

  revalidatePath("/customer/profile");
  revalidatePath("/supplier/profile");
  revalidatePath("/admin/users");
}
