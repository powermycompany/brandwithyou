"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function requestReservation(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const qtyRaw = String(formData.get("quantity") ?? "1");
  const quantity = Math.max(1, Math.floor(Number(qtyRaw) || 1));

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
  if (!profile || profile.status !== "active" || profile.role !== "customer") throw new Error("Customers only");

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
  if (quantity > avail) throw new Error(`Only ${avail} available`);

  const { error: insErr } = await supabase.from("reservations").insert({
    product_id: productId,
    supplier_id: (pr as any).supplier_id,
    customer_id: uid,
    quantity,
    status: "requested",
  } as any);

  if (insErr) throw new Error(insErr.message);

  revalidatePath("/market");
  revalidatePath(`/product/${productId}`);
  revalidatePath("/customer/reservations");
  revalidatePath("/supplier/reservations");
}
