"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Gender = "men" | "women" | "unisex";
type Condition = "new" | "secondhand";
type Status = "draft" | "published";

function asInt(v: FormDataEntryValue | null) {
  const n = Number(String(v ?? "").trim());
  if (!Number.isFinite(n)) throw new Error("invalid number");
  return n;
}

function asStr(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error("missing field");
  return s;
}

function asOptStr(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function asGender(v: FormDataEntryValue | null): Gender {
  const s = String(v ?? "").trim();
  if (s === "men" || s === "women" || s === "unisex") return s;
  throw new Error("invalid gender");
}

function asCondition(v: FormDataEntryValue | null): Condition {
  const s = String(v ?? "").trim();
  if (s === "new" || s === "secondhand") return s;
  throw new Error("invalid condition");
}

function asStatus(v: FormDataEntryValue | null): Status {
  const s = String(v ?? "").trim();
  if (s === "draft" || s === "published") return s;
  throw new Error("invalid status");
}

type PreImg = {
  path: string;
  fileName?: string;
};

function movePathToProduct(path: string, userId: string, productId: string) {
  const parts = path.split("/");
  const filename = parts[parts.length - 1] || path;
  return `${userId}/${productId}/${filename}`;
}

export async function supplierCreateProduct(formData: FormData) {
  const supabase = await supabaseServer();

  const { data: me } = await supabase.auth.getUser();
  if (!me.user) redirect("/login");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id,status,role")
    .eq("id", me.user.id)
    .maybeSingle();

  if (!myProfile || myProfile.status !== "active" || myProfile.role !== "supplier") {
    redirect("/market");
  }

  const main_category_id = asInt(formData.get("main_category_id"));
  const brand_id = asInt(formData.get("brand_id"));
  const brand_subcategory_id = asInt(formData.get("brand_subcategory_id"));
  const product_type_id = asInt(formData.get("product_type_id"));

  const product_name = asStr(formData.get("product_name"));
  const gender = asGender(formData.get("gender"));
  const reference_code = asStr(formData.get("reference_code"));
  const serial_number = asOptStr(formData.get("serial_number"));

  const condition = asCondition(formData.get("condition"));
  const currency = asStr(formData.get("currency")).toUpperCase().slice(0, 3);

  const base_price = asInt(formData.get("base_price"));
  const qty = asInt(formData.get("quantity_total"));

  // Optional in the form, so do not throw when blank.
  // Use empty string to avoid breaking schemas that define these columns as NOT NULL text.
  const color = asOptStr(formData.get("color")) ?? "";
  const material = asOptStr(formData.get("material")) ?? "";
  const hardware_details = asOptStr(formData.get("hardware_details"));
  const size_specs = asOptStr(formData.get("size_specs"));
  const description = asOptStr(formData.get("description"));

  const status = asStatus(formData.get("status"));

  const images_json = asOptStr(formData.get("pre_uploaded_images_json"));
  let preImages: PreImg[] = [];

  if (images_json) {
    try {
      const parsed = JSON.parse(images_json);
      preImages = Array.isArray(parsed)
        ? parsed.filter((x): x is PreImg => !!x && typeof x.path === "string" && x.path.trim().length > 0)
        : [];
    } catch {
      throw new Error("invalid pre_uploaded_images_json");
    }
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      supplier_id: me.user.id,
      main_category_id,
      brand_id,
      brand_subcategory_id,
      product_type_id,

      product_name,
      gender,
      reference_code,
      serial_number,

      condition,
      currency,

      color,
      material,
      hardware_details,
      size_specs,
      description,

      quantity_total: qty,
      quantity_available: qty,

      status,

      retail_price: 0,
    })
    .select("id")
    .single();

  if (productError) throw new Error(productError.message);

  const { error: pricingError } = await supabase
    .from("product_supplier_pricing")
    .insert({
      product_id: product.id,
      supplier_id: me.user.id,
      base_price,
      currency,
    });

  if (pricingError) throw new Error(pricingError.message);

  if (preImages.length > 0) {
    const bucket = supabase.storage.from("product-images");
    const finalPaths: string[] = [];

    for (const im of preImages) {
      const from = im.path;
      const to = movePathToProduct(from, me.user.id, product.id);

      const dl = await bucket.download(from);
      if (dl.error) throw new Error(dl.error.message);

      const up = await bucket.upload(to, dl.data as Blob, { upsert: false });
      if (up.error) throw new Error(up.error.message);

      const rm = await bucket.remove([from]);
      if (rm.error) throw new Error(rm.error.message);

      finalPaths.push(to);
    }

    const rows = finalPaths.map((p) => ({ product_id: product.id, storage_path: p }));
    const { error: imgErr } = await supabase.from("product_images").insert(rows);
    if (imgErr) throw new Error(imgErr.message);
  }

  redirect(`/supplier/products/${product.id}`);
}