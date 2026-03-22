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

export async function updateSupplierProfile(formData: FormData) {
  const full_name = clean(formData.get("full_name"));
  const account_name = clean(formData.get("account_name"));
  const phone = clean(formData.get("phone"));
  const country = clean(formData.get("country"));
  const preferred_language = clean(formData.get("preferred_language")) ?? "en";
  const preferredBrandIds = parseIds(formData.get("preferred_brand_ids_json"));

  if (!full_name) throw new Error("full_name required");
  if (!account_name) throw new Error("account_name required");

  const supabase = await supabaseServer();
  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);

  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: prof, error: pErr } = await supabase.from("profiles").select("id,role").eq("id", uid).maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!prof) throw new Error("Profile not found");
  if ((prof as any).role !== "supplier") throw new Error("Not a supplier");

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

  // Replace preferred brands
  const del = await supabase.from("supplier_preferred_brands").delete().eq("supplier_id", uid);
  if (del.error) throw new Error(del.error.message);

  if (preferredBrandIds.length) {
    const ins = await supabase.from("supplier_preferred_brands").insert(
      preferredBrandIds.map((bid) => ({ supplier_id: uid, brand_id: bid }))
    );
    if (ins.error) throw new Error(ins.error.message);
  }

  revalidatePath("/supplier/profile");
}
