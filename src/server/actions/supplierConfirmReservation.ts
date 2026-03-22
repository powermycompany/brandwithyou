"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function supplierConfirmReservation(formData: FormData) {
  const reservationId = String(formData.get("reservation_id") ?? "");
  if (!reservationId) throw new Error("reservation_id missing");

  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  // Load reservation (supplier must own it)
  const { data: r, error: rErr } = await supabase
    .from("reservations")
    .select("id,status,product_id,quantity,supplier_id,customer_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (rErr) throw new Error(rErr.message);
  if (!r) throw new Error("Reservation not found");
  if ((r as any).supplier_id !== uid) throw new Error("Not allowed");

  const status = String((r as any).status ?? "");

  // Idempotent: if not requested, just refresh pages
  if (status !== "requested") {
    revalidatePath("/supplier/reservations");
    revalidatePath("/supplier/messages");
    revalidatePath("/customer/messages");
    return;
  }

  // Confirm reservation (NO inventory change here per your rules)
  const { error: confErr } = await supabase
    .from("reservations")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("supplier_id", uid)
    .eq("status", "requested");

  if (confErr) throw new Error(confErr.message);

  // Create thread for this reservation (one thread per reservation)
  const { error: threadErr } = await supabase
    .from("chat_threads")
    .upsert(
      {
        reservation_id: reservationId,
        product_id: (r as any).product_id,
        supplier_id: (r as any).supplier_id,
        customer_id: (r as any).customer_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "reservation_id" }
    );

  if (threadErr) throw new Error(threadErr.message);

  revalidatePath("/supplier/reservations");
  revalidatePath("/supplier/messages");
  revalidatePath("/customer/messages");
  revalidatePath("/market");
}
