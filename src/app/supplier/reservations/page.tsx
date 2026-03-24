import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { supplierConfirmReservation } from "@/server/actions/supplierConfirmReservation";
import { supplierRejectReservation } from "@/server/actions/supplierRejectReservation";
import { supplierSoldReservation } from "@/server/actions/supplierSoldReservation";

type RelName = { name_en: string | null };
type RelMaybeMany = RelName | RelName[] | null | undefined;

type ProductRel = {
  id: string;
  product_name: string | null;
  reference_code: string | null;
  currency: string | null;
  quantity_available: number | null;
  brand_id: number | null;
  main_category_id: number | null;
  brand_subcategory_id: number | null;
  product_type_id: number | null;
  gender: string | null;
  condition: string | null;
  catalog_brands?: RelName | null;
  catalog_main_categories?: RelName | null;
  catalog_brand_subcategories?: RelName | null;
  catalog_product_types?: RelName | null;
};

type RawProductRel = Omit<
  ProductRel,
  | "catalog_brands"
  | "catalog_main_categories"
  | "catalog_brand_subcategories"
  | "catalog_product_types"
> & {
  catalog_brands?: RelMaybeMany;
  catalog_main_categories?: RelMaybeMany;
  catalog_brand_subcategories?: RelMaybeMany;
  catalog_product_types?: RelMaybeMany;
};

type CustomerRel = {
  account_name: string | null;
  email: string | null;
  country: string | null;
} | null;

type Row = {
  id: string;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  created_at: string;
  quantity: number;
  product_id: string;
  customer_id: string;
  products: ProductRel | null;
  customer: CustomerRel;
};

type RawRow = Omit<Row, "products"> & {
  products: RawProductRel | RawProductRel[] | null;
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

function firstRel<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeProduct(value: RawProductRel | RawProductRel[] | null | undefined): ProductRel | null {
  const p = firstRel(value);
  if (!p) return null;

  return {
    ...p,
    catalog_brands: firstRel(p.catalog_brands),
    catalog_main_categories: firstRel(p.catalog_main_categories),
    catalog_brand_subcategories: firstRel(p.catalog_brand_subcategories),
    catalog_product_types: firstRel(p.catalog_product_types),
  };
}

export default async function SupplierReservationsPage() {
  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,status,created_at,quantity,product_id,customer_id,
      products:products!reservations_product_id_fkey(
        id,
        product_name,
        reference_code,
        currency,
        quantity_available,
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
      customer:profiles!reservations_customer_id_fkey(
        account_name,
        email,
        country
      )
    `.trim()
    )
    .eq("supplier_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rawRows = ((data ?? []) as unknown) as RawRow[];
  const rows: Row[] = rawRows.map((r) => ({
    ...r,
    products: normalizeProduct(r.products),
  }));

  const newRequestCount = rows.filter((r) => r.status === "requested").length;

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
          <div className="row supplierReservationsHeaderRow" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 className="h1">Reservations</h1>
              <p className="p">
                Review customer requests with full product context, requested quantities, pricing, and customer location.
                Requested reservations can be confirmed. Once confirmed, they may be rejected or marked as sold. Rejected
                and sold reservations are final and cannot return to a previous status.
              </p>
            </div>

            <div className="badge">
              <span>New requests</span>
              <span className="kbd">{newRequestCount}</span>
            </div>
          </div>
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
            const canConfirm = r.status === "requested";
            const canReject = r.status === "requested" || r.status === "confirmed";
            const canSold = r.status === "confirmed";
            const showActions = r.status === "requested" || r.status === "confirmed";
            const isNewRequest = r.status === "requested";

            const productName = r.products?.product_name ?? "Product";
            const qty = Number(r.quantity ?? 1);
            const avail = Number(r.products?.quantity_available ?? 0);

            const brand =
              r.products?.catalog_brands?.name_en ??
              (r.products?.brand_id != null ? `#${r.products.brand_id}` : "—");

            const category =
              r.products?.catalog_main_categories?.name_en ??
              (r.products?.main_category_id != null ? `#${r.products.main_category_id}` : "—");

            const subcategory =
              r.products?.catalog_brand_subcategories?.name_en ??
              (r.products?.brand_subcategory_id != null ? `#${r.products.brand_subcategory_id}` : "—");

            const productType =
              r.products?.catalog_product_types?.name_en ??
              (r.products?.product_type_id != null ? `#${r.products.product_type_id}` : "—");

            const pricing = pricingByProductId.get(String(r.product_id));
            const ccy = pricing?.currency ?? String(r.products?.currency ?? "USD").toUpperCase();
            const unitPrice = pricing?.final_price ?? null;
            const totalPrice = unitPrice === null ? null : unitPrice * qty;

            return (
              <div
                className="card"
                key={r.id}
                style={
                  isNewRequest
                    ? {
                        border: "1px solid rgba(198,40,40,0.22)",
                        boxShadow: "0 12px 28px rgba(198,40,40,0.08)",
                      }
                    : undefined
                }
              >
                <div className="cardInner">
                  <div
                    className="row supplierReservationsCardRow"
                    style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
                  >
                    <div className="supplierReservationsInfo" style={{ minWidth: 260, flex: "1 1 auto" }}>
                      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div className="supplierReservationsTitle" style={{ fontWeight: 650 }}>{productName}</div>

                        {isNewRequest ? (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: "rgba(198,40,40,0.10)",
                              border: "1px solid rgba(198,40,40,0.16)",
                              color: "#8e1f1f",
                              fontWeight: 650,
                              fontSize: 13,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "999px",
                                background: "#c62828",
                                display: "inline-block",
                              }}
                            />
                            New request
                          </div>
                        ) : null}
                      </div>

                      <div className="p">Requested: {d(r.created_at)}</div>
                      <div className="p supplierReservationsCustomerLine">
                        Customer: {r.customer?.account_name ?? r.customer_id}
                        {r.customer?.email ? ` · ${r.customer.email}` : ""}
                      </div>
                      <div className="spacer" style={{ height: 8 }} />

                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <div className="badge">
                          <span>Brand</span>
                          <span className="kbd">{brand}</span>
                        </div>
                        <div className="badge">
                          <span>Category</span>
                          <span className="kbd">{category}</span>
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
                          <span className="kbd">{genderLabel(r.products?.gender)}</span>
                        </div>
                        {r.products?.reference_code ? (
                          <div className="badge">
                            <span>Product No.</span>
                            <span className="kbd">{r.products.reference_code}</span>
                          </div>
                        ) : null}
                        <div className="badge">
                          <span>Condition</span>
                          <span className="kbd">{r.products?.condition ?? "—"}</span>
                        </div>
                        <div className="badge">
                          <span>Customer country</span>
                          <span className="kbd">{r.customer?.country ?? "—"}</span>
                        </div>
                        <div className="badge">
                          <span>Requested amount</span>
                          <span className="kbd">{qty}</span>
                        </div>
                        <div className="badge">
                          <span>Available amount</span>
                          <span className="kbd">{avail}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="row supplierReservationsActions"
                      style={{
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
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

                      <Link className="btn btnPrimary supplierReservationsActionButton" href={`/product/${r.product_id}`}>
                        View product
                      </Link>

                      {showActions ? (
                        <>
                          <form className="supplierReservationsActionForm" action={supplierConfirmReservation}>
                            <input type="hidden" name="reservation_id" value={r.id} />
                            <button className="btn btnPrimary supplierReservationsActionButton" type="submit" disabled={!canConfirm}>
                              Confirm
                            </button>
                          </form>

                          <form className="supplierReservationsActionForm" action={supplierRejectReservation}>
                            <input type="hidden" name="reservation_id" value={r.id} />
                            <button className="btn supplierReservationsActionButton" type="submit" disabled={!canReject}>
                              Reject
                            </button>
                          </form>

                          <form className="supplierReservationsActionForm" action={supplierSoldReservation}>
                            <input type="hidden" name="reservation_id" value={r.id} />
                            <button className="btn supplierReservationsActionButton" type="submit" disabled={!canSold}>
                              Sold
                            </button>
                          </form>
                        </>
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