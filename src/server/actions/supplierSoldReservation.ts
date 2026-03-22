"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function supplierSoldReservation(formData: FormData) {
  const reservationId = String(formData.get("reservation_id") ?? "");
  if (!reservationId) throw new Error("reservation_id missing");

  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: r, error: rErr } = await supabase
    .from("reservations")
    .select("id,status,product_id,quantity,supplier_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (rErr) throw new Error(rErr.message);
  if (!r) throw new Error("Reservation not found");
  if ((r as any).supplier_id !== uid) throw new Error("Not allowed");

  const status = String((r as any).status ?? "");
  if (status !== "confirmed") throw new Error("Only confirmed reservations can be marked sold");

  const qty = Number((r as any).quantity ?? 1);

  const { data: p, error: pErr } = await supabase
    .from("products")
    .select("id,quantity_available,status")
    .eq("id", (r as any).product_id)
    .maybeSingle();

  if (pErr) throw new Error(pErr.message);
  if (!p) throw new Error("Product not found");

  const currentAvail = Number((p as any).quantity_available ?? 0);
  if (currentAvail < qty) throw new Error("Not enough quantity available");

  const nextAvail = currentAvail - qty;

  // mark sold (completed)
  const { error: doneErr } = await supabase
    .from("reservations")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("supplier_id", uid)
    .eq("status", "confirmed");

  if (doneErr) throw new Error(doneErr.message);

  // decrement inventory on SOLD only
  const { error: qErr } = await supabase
    .from("products")
    .update({
      quantity_available: nextAvail,
      status: nextAvail === 0 ? "draft" : (p as any).status,
    })
    .eq("id", (r as any).product_id);

  if (qErr) throw new Error(qErr.message);

  // if inventory exhausted, cancel competing *requested* reservations
  if (nextAvail === 0) {
    const { error: cancelErr } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("product_id", (r as any).product_id)
      .eq("status", "requested");

    if (cancelErr) throw new Error(cancelErr.message);
  }

  revalidatePath("/supplier/reservations");
  revalidatePath("/supplier/products");
  revalidatePath("/market");
}
