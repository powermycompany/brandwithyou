import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { customerCancelReservation } from "@/server/actions/customerCancelReservation";

type Row = {
  id: string;
  status: string;
  created_at: string;
  product_id: string;
  quantity: number | null;
  supplier_id: string | null;

  products:
    | {
        id: string;
        product_name: string | null;
        reference_code: string | null;
        currency: string | null;
        brand_id: number | null;
        brand_subcategory_id: number | null;
        product_type_id: number | null;
        gender: string | null;
        condition: string | null;
        catalog_brands?: { name_en: string | null } | null;
        catalog_brand_subcategories?: { name_en: string | null } | null;
        catalog_product_types?: { name_en: string | null } | null;
      }
    | null;

  supplier:
    | {
        country: string | null;
      }
    | null;
};

function d(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function money(ccy: string | null | undefined, n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `${String(ccy ?? "USD").toUpperCase()} ${v}`;
}

export default async function CustomerReservationsPage() {
  const supabase = await supabaseServer();
  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);

  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  await supabase.from("user_nav_state").upsert(
    { user_id: uid, key: "customer_reservations", last_seen_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );

  const { data: rowsRaw, error } = await supabase
    .from("reservations")
    .select(
      `
      id,status,created_at,product_id,quantity,supplier_id,
      products:products!reservations_product_id_fkey(
        id,
        product_name,
        reference_code,
        currency,
        brand_id,
        brand_subcategory_id,
        product_type_id,
        gender,
        condition,
        catalog_brands(name_en),
        catalog_brand_subcategories(name_en),
        catalog_product_types(name_en)
      ),
      supplier:profiles!reservations_supplier_id_fkey(
        country
      )
    `.trim()
    )
    .eq("customer_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = ((rowsRaw ?? []) as unknown) as Row[];

  const pricingByProductId = new Map<string, { currency: string; final_price: number | null }>();

  for (const r of rows) {
    const pid = String(r.product_id);
    if (!pid || pricingByProductId.has(pid)) continue;

    const { data: p } = await supabase.rpc("get_market_product_pricing", { p_product_id: pid }).maybeSingle();

    pricingByProductId.set(pid, {
      currency: String((p as any)?.currency ?? r.products?.currency ?? "USD").toUpperCase(),
      final_price:
        (p as any)?.final_price === null || (p as any)?.final_price === undefined
          ? null
          : Number((p as any).final_price),
    });
  }

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <h1 className="h1">My reservations</h1>
          <p className="p">
            A reservation is a request to purchase, not product sold. Suppliers may accept or decline reservations at their own discretion.
            A chat opens automatically once a supplier confirms your reservation. The supplier may use the message thread to request delivery
            preferences, payment arrangements, shipping address details, or other necessary information. Once the product has been sold to
            you, it will appear in Purchase history, where you can view completed purchases.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <div className="cardInner">
            <p className="p">No reservations yet.</p>
          </div>
        </div>
      ) : (
        <div className="row" style={{ flexDirection: "column", gap: 10 }}>
          {rows.map((r) => {
            const qty = Number(r.quantity ?? 1);
            const productName = r.products?.product_name ?? "Product";
            const canCancel = r.status === "requested" || r.status === "confirmed";

            const brand =
              r.products?.catalog_brands?.name_en ??
              (r.products?.brand_id != null ? `#${r.products.brand_id}` : "—");

            const subcategory =
              r.products?.catalog_brand_subcategories?.name_en ??
              (r.products?.brand_subcategory_id != null ? `#${r.products.brand_subcategory_id}` : "—");

            const productType =
              r.products?.catalog_product_types?.name_en ??
              (r.products?.product_type_id != null ? `#${r.products.product_type_id}` : "—");

            const supplierCountry = r.supplier?.country ?? "—";

            const pricing = pricingByProductId.get(String(r.product_id));
            const ccy = pricing?.currency ?? String(r.products?.currency ?? "USD").toUpperCase();
            const unitPrice = pricing?.final_price ?? null;
            const totalPrice = unitPrice === null ? null : unitPrice * qty;

            return (
              <div key={r.id} className="card">
                <div className="cardInner">
                  <div
                    className="row customerReservationRow"
                    style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
                  >
                    <div className="customerReservationInfo" style={{ minWidth: 260, flex: "1 1 auto" }}>
                      <div
                        className="customerReservationTitle"
                        style={{ fontWeight: 650 }}
                      >
                        {productName}
                      </div>
                      <div className="p">Reserved: {d(r.created_at)}</div>

                      <div className="spacer" style={{ height: 8 }} />

                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <div className="badge">
                          <span>Brand</span>
                          <span className="kbd">{brand}</span>
                        </div>
                        <div className="badge">
                          <span>Subcategory</span>
                          <span className="kbd">{subcategory}</span>
                        </div>
                        <div className="badge">
                          <span>Product type</span>
                          <span className="kbd">{productType}</span>
                        </div>
                        <div className="badge">
                          <span>Gender</span>
                          <span className="kbd">{r.products?.gender ?? "—"}</span>
                        </div>
                        {r.products?.reference_code ? (
                          <div className="badge">
                            <span>Reference</span>
                            <span className="kbd">{r.products.reference_code}</span>
                          </div>
                        ) : null}
                        <div className="badge">
                          <span>Condition</span>
                          <span className="kbd">{r.products?.condition ?? "—"}</span>
                        </div>
                        <div className="badge">
                          <span>Supplier country</span>
                          <span className="kbd">{supplierCountry}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="row customerReservationActions"
                      style={{
                        gap: 10,
                        alignItems: "center",
                        justifyContent: "flex-end",
                        flexWrap: "wrap",
                      }}
                    >
                      <div className="badge">
                        <span>Qty</span>
                        <span className="kbd">{qty}</span>
                      </div>
                      <div className="badge">
                        <span>Unit price</span>
                        <span className="kbd">{money(ccy, unitPrice)}</span>
                      </div>
                      <div className="badge">
                        <span>Total</span>
                        <span className="kbd">{money(ccy, totalPrice)}</span>
                      </div>
                      <div className="badge">
                        <span>Status</span>
                        <span className="kbd">{r.status}</span>
                      </div>

                      <Link className="btn btnPrimary customerReservationActionButton" href={`/product/${r.product_id}`}>
                        View product
                      </Link>

                      {canCancel ? (
                        <form className="customerReservationCancelForm" action={customerCancelReservation}>
                          <input type="hidden" name="reservation_id" value={r.id} />
                          <button className="btn customerReservationActionButton" type="submit">
                            Cancel reservation
                          </button>
                        </form>
                      ) : null}
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