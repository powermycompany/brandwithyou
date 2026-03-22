"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

export async function adminSetProductStatus(formData: FormData) {
  const supabase = await supabaseServer();

  const productId = String(formData.get("product_id") ?? "").trim();
  const nextStatus = String(formData.get("status") ?? "").trim();

  if (!productId) {
    throw new Error("Missing product id");
  }

  if (nextStatus !== "draft" && nextStatus !== "published") {
    throw new Error("Invalid status");
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) {
    throw new Error(userErr.message);
  }

  if (!user?.id) {
    throw new Error("Not authenticated");
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id,role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    throw new Error(profileErr.message);
  }

  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    throw new Error("Not authorized");
  }

  const { error: updateErr } = await supabase
    .from("products")
    .update({ status: nextStatus })
    .eq("id", productId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  revalidatePath("/admin/products");
  revalidatePath(`/product/${productId}`);
  revalidatePath("/luxe-atelier");
}