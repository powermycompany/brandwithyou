"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function supplierRejectReservation(formData: FormData) {
  const reservationId = String(formData.get("reservation_id") ?? "");
  if (!reservationId) throw new Error("reservation_id missing");

  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: r, error: rErr } = await supabase
    .from("reservations")
    .select("id,status,supplier_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (rErr) throw new Error(rErr.message);
  if (!r) throw new Error("Reservation not found");
  if ((r as any).supplier_id !== uid) throw new Error("Not allowed");

  const status = String((r as any).status ?? "");
  if (status === "completed") throw new Error("Cannot reject a sold reservation");

  const { error: cancelErr } = await supabase
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", reservationId)
    .eq("supplier_id", uid);

  if (cancelErr) throw new Error(cancelErr.message);

  revalidatePath("/supplier/reservations");
  revalidatePath("/supplier/products");
  revalidatePath("/market");
}
