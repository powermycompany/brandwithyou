"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function asStr(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error("missing field");
  return s;
}

export async function supplierCompleteReservation(formData: FormData) {
  const reservationId = asStr(formData.get("reservation_id"));

  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,status,role")
    .eq("id", me.user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active" || profile.role !== "supplier") redirect("/market");

  const { data: r } = await supabase
    .from("reservations")
    .select("id,supplier_id,status")
    .eq("id", reservationId)
    .maybeSingle();

  if (!r || (r as any).supplier_id !== me.user.id) redirect("/supplier/reservations");

  const { error } = await supabase
    .from("reservations")
    .update({ status: "completed", completed_at: new Date().toISOString() } as any)
    .eq("id", reservationId)
    .eq("supplier_id", me.user.id)
    .eq("status", "confirmed");

  if (error) throw new Error(error.message);

  redirect("/supplier/reservations");
}
