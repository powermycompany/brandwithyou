"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function asStr(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error("missing field");
  return s;
}

async function requireSupplier() {
  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) redirect("/login");

  const { data: p } = await supabase
    .from("profiles")
    .select("id,status,role")
    .eq("id", me.user.id)
    .maybeSingle();

  if (!p || p.status !== "active" || p.role !== "supplier") redirect("/market");
  return { supabase, userId: me.user.id };
}

export async function supplierDeleteProduct(formData: FormData) {
  const productId = asStr(formData.get("product_id"));
  const { supabase, userId } = await requireSupplier();

  const { data: pr } = await supabase
    .from("products")
    .select("id,supplier_id")
    .eq("id", productId)
    .maybeSingle();

  if (!pr || pr.supplier_id !== userId) redirect("/supplier/products");

  const { data: imgs } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("product_id", productId);

  const paths = (imgs ?? []).map((r: any) => r.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const rm = await supabase.storage.from("product-images").remove(paths);
    if (rm.error) throw new Error(rm.error.message);
  }

  const del = await supabase.from("products").delete().eq("id", productId).eq("supplier_id", userId);
  if (del.error) throw new Error(del.error.message);

  redirect("/supplier/products");
}
