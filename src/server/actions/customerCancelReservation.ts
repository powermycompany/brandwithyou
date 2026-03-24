"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function customerCancelReservation(formData: FormData) {
  const reservationId = String(formData.get("reservation_id") ?? "").trim();
  if (!reservationId) throw new Error("reservation_id missing");

  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);

  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: row, error: rowErr } = await supabase
    .from("reservations")
    .select("id,customer_id,status,product_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (rowErr) throw new Error(rowErr.message);
  if (!row) throw new Error("Reservation not found");
  if (String((row as any).customer_id) !== uid) throw new Error("Not allowed");

  const status = String((row as any).status ?? "");
  if (status !== "requested" && status !== "confirmed") {
    throw new Error("Only requested or confirmed reservations can be cancelled");
  }

  const { error: updErr } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", reservationId)
    .eq("customer_id", uid);

  if (updErr) throw new Error(updErr.message);

  revalidatePath("/customer/reservations");
  revalidatePath("/customer/messages");
  revalidatePath("/supplier/reservations");
  revalidatePath("/supplier/messages");
  revalidatePath(`/product/${String((row as any).product_id ?? "")}`);
  revalidatePath("/luxe-atelier");
}