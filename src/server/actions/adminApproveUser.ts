"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Role = "admin" | "supplier" | "customer";
type Status = "pending" | "active";

function asRole(v: string): Role {
  if (v === "admin" || v === "supplier" || v === "customer") return v;
  throw new Error("invalid role");
}

function asStatus(v: string): Status {
  if (v === "pending" || v === "active") return v;
  throw new Error("invalid status");
}

async function requireAdmin() {
  const supabase = await supabaseServer();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) redirect("/login");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id,status,role")
    .eq("id", me.user.id)
    .maybeSingle();

  if (!myProfile || myProfile.status !== "active" || myProfile.role !== "admin") {
    redirect("/market");
  }

  return { supabase, meId: me.user.id };
}

export async function adminSetUserStatusRole(formData: FormData) {
  const userId = String(formData.get("user_id") || "").trim();
  const role = asRole(String(formData.get("role") || "").trim());
  const status = asStatus(String(formData.get("status") || "").trim());

  if (!userId) throw new Error("missing user_id");

  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({ status, role })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  redirect("/admin/users");
}

export async function adminRevertToPending(formData: FormData) {
  const userId = String(formData.get("user_id") || "").trim();
  if (!userId) throw new Error("missing user_id");

  const { supabase, meId } = await requireAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", userId)
    .maybeSingle();

  if (!target) redirect("/admin/users");

  if (target.role === "admin") {
    redirect("/admin/users");
  }

  if (meId === userId) {
    redirect("/admin/users");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: "pending", role: null })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  redirect("/admin/users");
}
