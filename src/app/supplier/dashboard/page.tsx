import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type SoldRow = {
  id: string;
  created_at: string;
  completed_at: string | null;
  quantity: number | null;
  product_id: string;

  products:
    | {
        product_name: string | null;
        reference_code: string | null;
        brand_id: number | null;
        brand_subcategory_id: number | null;
        catalog_brands?: { name_en: string | null } | null;
        catalog_brand_subcategories?: { name_en: string | null } | null;
      }
    | null;

  customer:
    | {
        account_name: string | null;
        country: string | null;
      }
    | null;
};

type PricingRow = { product_id: string; base_price: number | null; currency: string | null };

function d(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function qtyOr1(n: any) {
  const v = Number(n ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function money(ccy: string, n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `${ccy.toUpperCase()} ${v}`;
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, 1);
  return dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function lastNMonthsKeys(n: number) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export default async function SupplierDashboardPage() {
  const supabase = await supabaseServer();
  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);

  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  async function sumReservationQty(status: "requested" | "confirmed" | "completed" | "cancelled") {
    const { data, error } = await supabase
      .from("reservations")
      .select("quantity")
      .eq("supplier_id", uid)
      .eq("status", status);

    if (error) throw new Error(error.message);

    return (data ?? []).reduce((acc: number, r: any) => acc + qtyOr1(r.quantity), 0);
  }

  const [productsTotal, productsListed, productsDraft] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("supplier_id", uid),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("supplier_id", uid).eq("status", "published"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("supplier_id", uid).eq("status", "draft"),
  ]);

  const { data: productsQtyRows, error: qtyErr } = await supabase
    .from("products")
    .select("quantity_available,brand_id,brand_subcategory_id")
    .eq("supplier_id", uid);

  if (qtyErr) throw new Error(qtyErr.message);

  const availableUnits =
    (productsQtyRows ?? []).reduce((acc: number, r: any) => acc + Number(r.quantity_available ?? 0), 0) ?? 0;

  const brandSet = new Set<number>();
  const subcatSet = new Set<number>();
  for (const r of productsQtyRows ?? []) {
    const b = (r as any).brand_id;
    const s = (r as any).brand_subcategory_id;
    if (typeof b === "number") brandSet.add(b);
    if (typeof s === "number") subcatSet.add(s);
  }

  const [requestedQty, confirmedQty, completedQty, cancelledQty] = await Promise.all([
    sumReservationQty("requested"),
    sumReservationQty("confirmed"),
    sumReservationQty("completed"),
    sumReservationQty("cancelled"),
  ]);

  const months12 = lastNMonthsKeys(12);
  const oldestKey = months12[0];
  const sinceIso = `${oldestKey}-01T00:00:00.000Z`;

  const { data: soldRowsRaw, error: soldErr } = await supabase
    .from("reservations")
    .select(
      `
      id,created_at,completed_at,quantity,product_id,
      products:products!reservations_product_id_fkey(
        product_name,reference_code,brand_id,brand_subcategory_id,
        catalog_brands(name_en),
        catalog_brand_subcategories(name_en)
      ),
      customer:profiles!reservations_customer_id_fkey(account_name,country)
    `.trim()
    )
    .eq("supplier_id", uid)
    .eq("status", "completed")
    .gte("completed_at", sinceIso)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (soldErr) throw new Error(soldErr.message);

  const soldRows = (soldRowsRaw ?? []) as SoldRow[];

  const { count: soldHistoryTotal, error: soldCountErr } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", uid)
    .eq("status", "completed");

  if (soldCountErr) throw new Error(soldCountErr.message);

  const productIds = Array.from(new Set(soldRows.map((r) => r.product_id).filter(Boolean)));
  const pricingMap = new Map<string, PricingRow>();

  if (productIds.length > 0) {
    const { data: pricingRows, error: priceErr } = await supabase
      .from("product_supplier_pricing")
      .select("product_id,base_price,currency")
      .eq("supplier_id", uid)
      .in("product_id", productIds);

    if (priceErr) throw new Error(priceErr.message);

    for (const p of pricingRows ?? []) {
      pricingMap.set(String((p as any).product_id), {
        product_id: String((p as any).product_id),
        base_price: (p as any).base_price === null ? null : Number((p as any).base_price),
        currency: (p as any).currency === null ? null : String((p as any).currency),
      });
    }
  }

  const totalsByCcy = new Map<string, { units: number; revenue_total: number }>();
  const monthlyByCcy = new Map<string, Map<string, { units: number; revenue_total: number }>>();
  const byBrand = new Map<string, { units: number; revenue_total: number }>();
  const bySubcat = new Map<string, { units: number; revenue_total: number }>();

  let soldUnitsAll = 0;

  for (const r of soldRows) {
    const qty = qtyOr1(r.quantity);
    soldUnitsAll += qty;

    const pr = pricingMap.get(r.product_id);
    const ccy = String((pr?.currency ?? "USD")).toUpperCase();
    const baseUnit = pr?.base_price ?? null;
    const totalRevenue = baseUnit === null ? 0 : baseUnit * qty;

    const t = totalsByCcy.get(ccy) ?? { units: 0, revenue_total: 0 };
    t.units += qty;
    t.revenue_total += totalRevenue;
    totalsByCcy.set(ccy, t);

    const soldAtISO = String(r.completed_at ?? r.created_at);
    const mk = monthKey(soldAtISO);

    if (months12.includes(mk)) {
      const mMap = monthlyByCcy.get(ccy) ?? new Map<string, { units: number; revenue_total: number }>();
      const m = mMap.get(mk) ?? { units: 0, revenue_total: 0 };
      m.units += qty;
      m.revenue_total += totalRevenue;
      mMap.set(mk, m);
      monthlyByCcy.set(ccy, mMap);
    }

    const brand =
      r.products?.catalog_brands?.name_en ??
      (r.products?.brand_id != null ? `#${r.products.brand_id}` : "—");

    const sub =
      r.products?.catalog_brand_subcategories?.name_en ??
      (r.products?.brand_subcategory_id != null ? `#${r.products.brand_subcategory_id}` : "—");

    const bAgg = byBrand.get(brand) ?? { units: 0, revenue_total: 0 };
    bAgg.units += qty;
    bAgg.revenue_total += totalRevenue;
    byBrand.set(brand, bAgg);

    const sAgg = bySubcat.get(sub) ?? { units: 0, revenue_total: 0 };
    sAgg.units += qty;
    sAgg.revenue_total += totalRevenue;
    bySubcat.set(sub, sAgg);
  }

  const ccyList = Array.from(totalsByCcy.keys()).sort();

  const topBrands = Array.from(byBrand.entries())
    .map(([name, v]) => ({ name, units: v.units, revenue: v.revenue_total }))
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, 8);

  const topSubcats = Array.from(bySubcat.entries())
    .map(([name, v]) => ({ name, units: v.units, revenue: v.revenue_total }))
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, 8);

  function lastMonthsRows(ccy: string) {
    const m = monthlyByCcy.get(ccy) ?? new Map<string, { units: number; revenue_total: number }>();
    const rows = months12
      .map((k) => {
        const v = m.get(k);
        return v ? { key: k, label: monthLabel(k), units: v.units, revenue: v.revenue_total } : null;
      })
      .filter(Boolean) as Array<{ key: string; label: string; units: number; revenue: number }>;

    return rows.sort((a, b) => (a.key < b.key ? 1 : -1));
  }

  const kpi = {
    total_products: productsTotal.count ?? 0,
    listed: productsListed.count ?? 0,
    draft: productsDraft.count ?? 0,
    requested_qty: requestedQty,
    confirmed_qty: confirmedQty,
    completed_qty: completedQty,
    cancelled_qty: cancelledQty,
    available_units: availableUnits,
    sold_units_all: soldUnitsAll,
    brands: brandSet.size,
    subcategories: subcatSet.size,
  };

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <h1 className="h1">Supplier Dashboard</h1>
              <p className="p">A total overview of sales history, product inventory, performance by brand and subcategories.</p>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Link className="btn" href="/supplier/products">Products</Link>
              <Link className="btn" href="/supplier/reservations">Reservations</Link>
              <Link className="btn btnPrimary" href="/supplier/products/new">New product</Link>
            </div>
          </div>

          <div className="spacer" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="badge"><span>Products</span><span className="kbd">{kpi.total_products}</span></div>
            <div className="badge"><span>Listed</span><span className="kbd">{kpi.listed}</span></div>
            <div className="badge"><span>Delisted</span><span className="kbd">{kpi.draft}</span></div>
            <div className="badge"><span>Available units</span><span className="kbd">{kpi.available_units}</span></div>
            <div className="badge"><span>Units sold</span><span className="kbd">{kpi.sold_units_all}</span></div>
            <div className="badge"><span>Brands</span><span className="kbd">{kpi.brands}</span></div>
            <div className="badge"><span>Subcategories</span><span className="kbd">{kpi.subcategories}</span></div>
          </div>

          <div className="spacer" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="badge"><span>Requested</span><span className="kbd">{kpi.requested_qty}</span></div>
            <div className="badge"><span>Confirmed</span><span className="kbd">{kpi.confirmed_qty}</span></div>
            <div className="badge"><span>Sold</span><span className="kbd">{kpi.completed_qty}</span></div>
            <div className="badge"><span>Cancelled</span><span className="kbd">{kpi.cancelled_qty}</span></div>
          </div>

          <div className="spacer" />

          {ccyList.length === 0 ? (
            <p className="p">No sales yet.</p>
          ) : (
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              {ccyList.map((ccy) => {
                const t = totalsByCcy.get(ccy)!;
                return (
                  <div key={ccy} className="card" style={{ width: 340, flex: "1 1 340px" }}>
                    <div className="cardInner">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 650 }}>{ccy}</div>
                        <div className="badge"><span>Units</span><span className="kbd">{t.units}</span></div>
                      </div>
                      <div className="spacer" style={{ height: 10 }} />
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div className="p">Total Revenue</div>
                        <div style={{ fontWeight: 650 }}>{money(ccy, t.revenue_total)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 12, alignItems: "stretch" }}>
        <div className="card" style={{ flex: "1 1 360px" }}>
          <div className="cardInner">
            <div style={{ fontWeight: 650, fontSize: 18 }}>Top brands</div>
            <p className="p">By total revenue.</p>
            <div className="spacer" />
            {topBrands.length === 0 ? (
              <p className="p">—</p>
            ) : (
              <div className="row" style={{ flexDirection: "column", gap: 8 }}>
                {topBrands.map((r) => (
                  <div key={r.name} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: "1 1 auto" }}>{r.name}</div>
                    <div className="p" style={{ width: 60, textAlign: "right" }}>{r.units}</div>
                    <div style={{ width: 140, textAlign: "right", fontWeight: 650 }}>
                      {Math.round(r.revenue * 100) / 100}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ flex: "1 1 360px" }}>
          <div className="cardInner">
            <div style={{ fontWeight: 650, fontSize: 18 }}>Top subcategories</div>
            <p className="p">By total revenue.</p>
            <div className="spacer" />
            {topSubcats.length === 0 ? (
              <p className="p">—</p>
            ) : (
              <div className="row" style={{ flexDirection: "column", gap: 8 }}>
                {topSubcats.map((r) => (
                  <div key={r.name} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: "1 1 auto" }}>{r.name}</div>
                    <div className="p" style={{ width: 60, textAlign: "right" }}>{r.units}</div>
                    <div style={{ width: 140, textAlign: "right", fontWeight: 650 }}>
                      {Math.round(r.revenue * 100) / 100}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {ccyList.length > 0 ? (
        <div className="card">
          <div className="cardInner">
            <div style={{ fontWeight: 650, fontSize: 18 }}>Sales over time</div>
            <p className="p">Last 12 months (monthly). Only months with sales are shown.</p>

            <div className="spacer" />

            {ccyList.map((ccy) => {
              const rows = lastMonthsRows(ccy);
              if (rows.length === 0) return null;

              return (
                <div key={ccy} className="card" style={{ marginBottom: 12 }}>
                  <div className="cardInner">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 650 }}>{ccy}</div>
                      <div className="badge">
                        <span>Months</span>
                        <span className="kbd">{rows.length}</span>
                      </div>
                    </div>

                    <div className="spacer" />

                    <div className="row" style={{ flexDirection: "column", gap: 8 }}>
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div className="p" style={{ width: 160 }}>Month</div>
                        <div className="p" style={{ width: 80, textAlign: "right" }}>Units</div>
                        <div className="p" style={{ width: 220, textAlign: "right" }}>Total Revenue</div>
                      </div>

                      <div className="hr" />

                      {rows.map((r) => (
                        <div key={r.key} className="row" style={{ justifyContent: "space-between" }}>
                          <div style={{ width: 160 }}>{r.label}</div>
                          <div style={{ width: 80, textAlign: "right" }}>{r.units}</div>
                          <div style={{ width: 220, textAlign: "right", fontWeight: 650 }}>
                            {money(ccy, r.revenue)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="cardInner">
          <details>
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 650, fontSize: 18 }}>Sales history</div>
                <p className="p">Completed transfers with purchaser details.</p>
              </div>

              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <div className="badge">
                  <span>Total</span>
                  <span className="kbd">{soldHistoryTotal ?? 0}</span>
                </div>
                <span className="btn">Open / close</span>
              </div>
            </summary>

            <div className="spacer" />

            {soldRows.length === 0 ? (
              <p className="p">No sold items yet.</p>
            ) : (
              <div className="row" style={{ flexDirection: "column", gap: 10 }}>
                {soldRows.map((r) => (
                  <div key={r.id} className="card">
                    <div className="cardInner">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 650 }}>{r.products?.product_name ?? "Product"}</div>
                          <div className="p">{r.products?.reference_code ?? r.product_id}</div>
                          <div className="p">
                            Customer: {r.customer?.account_name ?? "—"}
                            {r.customer?.country ? ` · ${r.customer.country}` : ""}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div className="badge">
                            <span>Qty</span>
                            <span className="kbd">{qtyOr1(r.quantity)}</span>
                          </div>
                          <div className="spacer" style={{ height: 8 }} />
                          <div className="p">Sold: {d(r.completed_at ?? r.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </details>
        </div>
      </div>
    </div>
  );
}