"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function asStr(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error("missing field");
  return s;
}
function asOptStr(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}
function asOptInt(v: FormDataEntryValue | null) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error("invalid number");
  return n;
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

export async function supplierSetProductStatus(formData: FormData) {
  const productId = asStr(formData.get("product_id"));
  const status = asStr(formData.get("status"));
  const { supabase, userId } = await requireSupplier();

  const { data: pr } = await supabase.from("products").select("id,supplier_id").eq("id", productId).maybeSingle();
  if (!pr || pr.supplier_id !== userId) redirect("/supplier/products");

  const up = await supabase.from("products").update({ status }).eq("id", productId).eq("supplier_id", userId);
  if (up.error) throw new Error(up.error.message);

  redirect(`/supplier/products/${productId}`);
}

export async function supplierUpdateProduct(formData: FormData) {
  const productId = asStr(formData.get("product_id"));
  const { supabase, userId } = await requireSupplier();

  const { data: pr } = await supabase.from("products").select("id,supplier_id").eq("id", productId).maybeSingle();
  if (!pr || pr.supplier_id !== userId) redirect("/supplier/products");

  const patch: any = {
    product_name: asStr(formData.get("product_name")),
    reference_code: asStr(formData.get("reference_code")),
    serial_number: asOptStr(formData.get("serial_number")),
    currency: asStr(formData.get("currency")).toUpperCase().slice(0, 3),
    color: asStr(formData.get("color")),
    material: asStr(formData.get("material")),
    hardware_details: asOptStr(formData.get("hardware_details")),
    size_specs: asOptStr(formData.get("size_specs")),
    description: asOptStr(formData.get("description")),
  };

  const up = await supabase.from("products").update(patch).eq("id", productId).eq("supplier_id", userId);
  if (up.error) throw new Error(up.error.message);

  const base_price = asOptInt(formData.get("base_price"));
  if (base_price !== null) {
    const prc = await supabase
      .from("product_supplier_pricing")
      .update({ base_price })
      .eq("product_id", productId)
      .eq("supplier_id", userId);
    if (prc.error) throw new Error(prc.error.message);
  }

  redirect(`/supplier/products/${productId}`);
}
