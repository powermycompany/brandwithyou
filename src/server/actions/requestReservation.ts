"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function requestReservation(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const qtyRaw = String(formData.get("quantity") ?? "1");
  const requestedQuantity = Math.max(1, Math.floor(Number(qtyRaw) || 1));

  if (!productId) throw new Error("product_id missing");

  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id,status,role")
    .eq("id", uid)
    .maybeSingle();

  if (profErr) throw new Error(profErr.message);
  if (!profile || profile.status !== "active" || profile.role !== "customer") {
    throw new Error("Customers only");
  }

  const { data: pr, error: prErr } = await supabase
    .from("products")
    .select("id,supplier_id,status,quantity_available")
    .eq("id", productId)
    .maybeSingle();

  if (prErr) throw new Error(prErr.message);
  if (!pr) throw new Error("Product not found");
  if ((pr as any).status !== "published") throw new Error("Not listed");

  const avail = Number((pr as any).quantity_available ?? 0);
  if (avail <= 0) throw new Error("Out of stock");

  const { data: existing, error: existingErr } = await supabase
    .from("reservations")
    .select("id,quantity,status")
    .eq("product_id", productId)
    .eq("customer_id", uid)
    .in("status", ["requested", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  if (!existing) {
    if (requestedQuantity > avail) throw new Error(`Only ${avail} available`);

    const { error: insErr } = await supabase.from("reservations").insert({
      product_id: productId,
      supplier_id: (pr as any).supplier_id,
      customer_id: uid,
      quantity: requestedQuantity,
      status: "requested",
    } as any);

    if (insErr) throw new Error(insErr.message);
  } else {
    const currentQty = Math.max(1, Number((existing as any).quantity ?? 1));

    if (requestedQuantity === currentQty) {
      revalidatePath("/luxe-atelier");
      revalidatePath(`/product/${productId}`);
      revalidatePath("/customer/reservations");
      revalidatePath("/supplier/reservations");
      return;
    }

    if (requestedQuantity > currentQty) {
      const additionalNeeded = requestedQuantity - currentQty;
      if (additionalNeeded > avail) {
        throw new Error(`Only ${avail} additional item(s) available`);
      }
    }

    const { error: updErr } = await supabase
      .from("reservations")
      .update({
        quantity: requestedQuantity,
      } as any)
      .eq("id", (existing as any).id);

    if (updErr) throw new Error(updErr.message);
  }

  revalidatePath("/luxe-atelier");
  revalidatePath(`/product/${productId}`);
  revalidatePath("/customer/reservations");
  revalidatePath("/supplier/reservations");
}