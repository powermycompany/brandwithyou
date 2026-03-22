import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type Row = {
  id: string;
  status: "completed";
  created_at: string;
  completed_at: string | null;
  quantity: number | null;
  product_id: string;
  supplier_id: string;

  product:
    | {
        id: string;
        product_name: string | null;
        reference_code: string | null;
        currency: string | null;
        brand_id: number | null;
        main_category_id: number | null;
        brand_subcategory_id: number | null;
        product_type_id: number | null;
        gender: string | null;
        condition: string | null;
        catalog_brands?: { name_en: string | null } | null;
        catalog_main_categories?: { name_en: string | null } | null;
        catalog_brand_subcategories?: { name_en: string | null } | null;
        catalog_product_types?: { name_en: string | null } | null;
      }
    | null;

  supplier:
    | {
        account_name: string | null;
        email: string | null;
        country: string | null;
      }
    | null;
};

function d(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function money(ccy: string, n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `${String(ccy).toUpperCase()} ${v}`;
}

function safeText(v: unknown) {
  return String(v ?? "").trim();
}

function genderLabel(v: unknown) {
  const x = safeText(v).toLowerCase();
  if (x === "men" || x === "male" || x === "man") return "Men";
  if (x === "women" || x === "female" || x === "woman") return "Women";
  if (x === "unisex") return "Unisex";
  return "—";
}

export default async function CustomerPurchaseHistoryPage() {
  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  await supabase.from("user_nav_state").upsert(
    { user_id: uid, key: "customer_purchases", last_seen_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );

  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,status,created_at,completed_at,quantity,product_id,supplier_id,
      product:products!reservations_product_id_fkey(
        id,
        product_name,
        reference_code,
        currency,
        brand_id,
        main_category_id,
        brand_subcategory_id,
        product_type_id,
        gender,
        condition,
        catalog_brands(name_en),
        catalog_main_categories(name_en),
        catalog_brand_subcategories(name_en),
        catalog_product_types(name_en)
      ),
      supplier:profiles!reservations_supplier_id_fkey(account_name,email,country)
    `.trim()
    )
    .eq("customer_id", uid)
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];

  const pricingByProductId = new Map<
    string,
    { currency: string; base_price: number | null; final_price: number | null }
  >();

  for (const r of rows) {
    const pid = String(r.product_id);
    if (!pid || pricingByProductId.has(pid)) continue;

    const { data: p } = await supabase
      .rpc("get_market_product_pricing", { p_product_id: pid })
      .maybeSingle();

    if (p) {
      pricingByProductId.set(pid, {
        currency: String((p as any).currency ?? (r.product?.currency ?? "USD")).toUpperCase(),
        base_price: (p as any).base_price === null ? null : Number((p as any).base_price),
        final_price: (p as any).final_price === null ? null : Number((p as any).final_price),
      });
    } else {
      pricingByProductId.set(pid, {
        currency: String(r.product?.currency ?? "USD").toUpperCase(),
        base_price: null,
        final_price: null,
      });
    }
  }

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
          >
            <div>
              <h1 className="h1">Purchase history</h1>
              <p className="p">
                View your completed purchases, confirmed transaction values, and the supplier
                details connected to each completed order.
              </p>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Link className="btn" href="/customer/reservations">
                My reservations
              </Link>
              <Link className="btn" href="/luxe-atelier">
                Luxe Atelier
              </Link>
            </div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <div className="cardInner">
            <p className="p">No purchases yet.</p>
          </div>
        </div>
      ) : (
        <div className="row" style={{ flexDirection: "column", gap: 10 }}>
          {rows.map((r) => {
            const qty = Number(r.quantity ?? 1);
            const name = r.product?.product_name ?? "Product";
            const soldAt = r.completed_at ?? r.created_at;

            const mainCategory =
              r.product?.catalog_main_categories?.name_en ??
              (r.product?.main_category_id != null ? `#${r.product.main_category_id}` : "—");

            const brand =
              r.product?.catalog_brands?.name_en ??
              (r.product?.brand_id != null ? `#${r.product.brand_id}` : "—");

            const brandSubcategory =
              r.product?.catalog_brand_subcategories?.name_en ??
              (r.product?.brand_subcategory_id != null ? `#${r.product.brand_subcategory_id}` : "—");

            const productType =
              r.product?.catalog_product_types?.name_en ??
              (r.product?.product_type_id != null ? `#${r.product.product_type_id}` : "—");

            const supplierName = r.supplier?.account_name ?? r.supplier_id;
            const supplierEmail = r.supplier?.email ?? "—";
            const supplierCountry = r.supplier?.country ?? "—";

            const pricing = pricingByProductId.get(String(r.product_id));
            const ccy = pricing?.currency ?? String(r.product?.currency ?? "USD").toUpperCase();
            const unitFinal = pricing?.final_price ?? null;
            const totalFinal = unitFinal === null ? null : unitFinal * qty;

            return (
              <div key={r.id} className="card">
                <div className="cardInner">
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ minWidth: 260, flex: "1 1 auto" }}>
                      <div style={{ fontWeight: 650 }}>{name}</div>
                      <div className="p">Supplier: {supplierName}</div>
                      <div className="p">Email: {supplierEmail}</div>
                      <div className="p">Purchase date: {d(soldAt)}</div>

                      <div className="spacer" style={{ height: 8 }} />

                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <div className="badge">
                          <span>Main Category</span>
                          <span className="kbd">{mainCategory}</span>
                        </div>
                        <div className="badge">
                          <span>Brand</span>
                          <span className="kbd">{brand}</span>
                        </div>
                        <div className="badge">
                          <span>Brand Subcategory</span>
                          <span className="kbd">{brandSubcategory}</span>
                        </div>
                        <div className="badge">
                          <span>Product Type</span>
                          <span className="kbd">{productType}</span>
                        </div>
                        <div className="badge">
                          <span>Gender</span>
                          <span className="kbd">{genderLabel(r.product?.gender)}</span>
                        </div>
                        {r.product?.reference_code ? (
                          <div className="badge">
                            <span>Product No.</span>
                            <span className="kbd">{r.product.reference_code}</span>
                          </div>
                        ) : null}
                        <div className="badge">
                          <span>Condition</span>
                          <span className="kbd">{r.product?.condition ?? "—"}</span>
                        </div>
                        <div className="badge">
                          <span>Supplier country</span>
                          <span className="kbd">{supplierCountry}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="row"
                      style={{
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <div className="badge">
                        <span>Qty</span>
                        <span className="kbd">{qty}</span>
                      </div>
                      <div className="badge">
                        <span>Price Per Unit</span>
                        <span className="kbd">{money(ccy, unitFinal)}</span>
                      </div>
                      <div className="badge">
                        <span>Total</span>
                        <span className="kbd">{money(ccy, totalFinal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}