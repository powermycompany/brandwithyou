"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function adminUpdateSupplierMargin(formData: FormData) {
  const supabase = await supabaseServer();

  const supplierId = String(formData.get("supplier_id") ?? "").trim();
  const marginRaw = String(formData.get("margin_pct") ?? "").trim();

  if (!supplierId) {
    throw new Error("Missing supplier id");
  }

  const marginPct = Number(marginRaw);
  if (!Number.isFinite(marginPct) || marginPct < 0) {
    throw new Error("Margin must be a valid number greater than or equal to 0");
  }

  const { error } = await supabase
    .from("supplier_margin_rules")
    .upsert(
      {
        supplier_id: supplierId,
        margin_pct: marginPct,
      },
      { onConflict: "supplier_id" }
    );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/suppliers");
}