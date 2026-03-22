"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function clean(s: any) {
  const v = String(s ?? "").trim();
  return v.length ? v : null;
}

function parseIds(json: any): number[] {
  try {
    const arr = JSON.parse(String(json ?? "[]"));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

export async function updateCustomerProfile(formData: FormData) {
  const full_name = clean(formData.get("full_name"));
  const account_name = clean(formData.get("account_name"));
  const phone = clean(formData.get("phone"));
  const country = clean(formData.get("country"));
  const preferred_language = clean(formData.get("preferred_language")) ?? "en";
  const gender = clean(formData.get("gender")); // women|men|na|null
  const favoriteBrandIds = parseIds(formData.get("favorite_brand_ids_json"));

  if (!full_name) throw new Error("full_name required");
  if (!account_name) throw new Error("account_name required");
  if (gender && !["women", "men", "na"].includes(gender)) throw new Error("invalid gender");

  const supabase = await supabaseServer();
  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);

  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: prof, error: pErr } = await supabase.from("profiles").select("id,role").eq("id", uid).maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!prof) throw new Error("Profile not found");
  if ((prof as any).role !== "customer") throw new Error("Not a customer");

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name,
      account_name,
      phone,
      country,
      preferred_language,
      gender: gender ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", uid);

  if (error) throw new Error(error.message);

  // Replace favorite brands (simple + correct)
  const del = await supabase.from("customer_favorite_brands").delete().eq("customer_id", uid);
  if (del.error) throw new Error(del.error.message);

  if (favoriteBrandIds.length) {
    const ins = await supabase.from("customer_favorite_brands").insert(
      favoriteBrandIds.map((bid) => ({ customer_id: uid, brand_id: bid }))
    );
    if (ins.error) throw new Error(ins.error.message);
  }

  revalidatePath("/customer/profile");
}
