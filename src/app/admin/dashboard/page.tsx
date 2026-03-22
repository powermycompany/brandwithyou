import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

function money(ccy: string, n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `${ccy.toUpperCase()} ${v}`;
}

function qtyOr1(n: unknown) {
  const v = Number(n ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
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

export default async function AdminDashboardPage() {
  const supabase = await supabaseServer();

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStartIso = `${thisMonthKey}-01T00:00:00.000Z`;

  const months12 = lastNMonthsKeys(12);
  const oldestKey = months12[0];
  const sinceIso = `${oldestKey}-01T00:00:00.000Z`;

  const [
    usersRaw,
    productsCount,
    listedCount,
    reservationsRaw,
    productsQtyRaw,
    completedMonthRaw,
    productsCreatedThisMonthCount,
    reservationsThisMonthRaw,
    productsLast12MonthsRaw,
    reservationsLast12MonthsRaw,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,status,role,account_name")
      .order("created_at", { ascending: false }),

    supabase.from("products").select("id", { count: "exact", head: true }),

    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "published"),

    supabase
      .from("reservations")
      .select("id,status,quantity,created_at,completed_at,supplier_id,product_id"),

    supabase
      .from("products")
      .select("id,quantity_available,brand_id,brand_subcategory_id")
      .eq("status", "published"),

    supabase
      .from("reservations")
      .select(
        `
        id,quantity,completed_at,created_at,supplier_id,product_id,
        products:products!reservations_product_id_fkey(
          brand_id,
          brand_subcategory_id,
          catalog_brands(name_en),
          catalog_brand_subcategories(name_en)
        )
      `.trim()
      )
      .eq("status", "completed")
      .gte("completed_at", monthStartIso)
      .order("completed_at", { ascending: false }),

    supabase.from("products").select("id", { count: "exact", head: true }).gte("created_at", monthStartIso),

    supabase
      .from("reservations")
      .select("id,status,quantity,created_at")
      .gte("created_at", monthStartIso),

    supabase
      .from("products")
      .select("id,created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),

    supabase
      .from("reservations")
      .select("id,status,quantity,created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),
  ]);

  if (usersRaw.error) throw new Error(usersRaw.error.message);
  if (reservationsRaw.error) throw new Error(reservationsRaw.error.message);
  if (productsQtyRaw.error) throw new Error(productsQtyRaw.error.message);
  if (completedMonthRaw.error) throw new Error(completedMonthRaw.error.message);
  if (reservationsThisMonthRaw.error) throw new Error(reservationsThisMonthRaw.error.message);
  if (productsLast12MonthsRaw.error) throw new Error(productsLast12MonthsRaw.error.message);
  if (reservationsLast12MonthsRaw.error) throw new Error(reservationsLast12MonthsRaw.error.message);

  const users = usersRaw.data ?? [];
  const reservations = reservationsRaw.data ?? [];
  const productQtyRows = productsQtyRaw.data ?? [];
  const completedMonthRows = (completedMonthRaw.data ?? []) as any[];
  const reservationsThisMonth = reservationsThisMonthRaw.data ?? [];
  const productsLast12Months = productsLast12MonthsRaw.data ?? [];
  const reservationsLast12Months = reservationsLast12MonthsRaw.data ?? [];

  const activeSuppliers = users.filter((u: any) => u.status === "active" && u.role === "supplier").length;
  const activeCustomers = users.filter((u: any) => u.status === "active" && u.role === "customer").length;
  const pendingUsers = users.filter((u: any) => u.status === "pending").length;

  const availableUnits = productQtyRows.reduce((acc: number, r: any) => acc + Number(r.quantity_available ?? 0), 0);

  let requestedQty = 0;
  let confirmedQty = 0;
  let completedQty = 0;
  let cancelledQty = 0;

  for (const r of reservations) {
    const qty = qtyOr1((r as any).quantity);
    if ((r as any).status === "requested") requestedQty += qty;
    if ((r as any).status === "confirmed") confirmedQty += qty;
    if ((r as any).status === "completed") completedQty += qty;
    if ((r as any).status === "cancelled") cancelledQty += qty;
  }

  let reservationsCreatedThisMonth = 0;
  let reservationsRequestedThisMonth = 0;
  let reservationsConfirmedThisMonth = 0;
  let reservationsCompletedThisMonth = 0;
  let reservationsCancelledThisMonth = 0;

  for (const r of reservationsThisMonth) {
    const qty = qtyOr1((r as any).quantity);
    reservationsCreatedThisMonth += qty;

    if ((r as any).status === "requested") reservationsRequestedThisMonth += qty;
    if ((r as any).status === "confirmed") reservationsConfirmedThisMonth += qty;
    if ((r as any).status === "completed") reservationsCompletedThisMonth += qty;
    if ((r as any).status === "cancelled") reservationsCancelledThisMonth += qty;
  }

  const productsByMonth = new Map<string, number>();
  for (const p of productsLast12Months) {
    const mk = monthKey(String((p as any).created_at));
    productsByMonth.set(mk, (productsByMonth.get(mk) ?? 0) + 1);
  }

  const reservationsByMonth = new Map<
    string,
    { requested: number; confirmed: number; completed: number; cancelled: number }
  >();

  for (const r of reservationsLast12Months) {
    const mk = monthKey(String((r as any).created_at));
    const qty = qtyOr1((r as any).quantity);
    const current = reservationsByMonth.get(mk) ?? {
      requested: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    if ((r as any).status === "requested") current.requested += qty;
    if ((r as any).status === "confirmed") current.confirmed += qty;
    if ((r as any).status === "completed") current.completed += qty;
    if ((r as any).status === "cancelled") current.cancelled += qty;

    reservationsByMonth.set(mk, current);
  }

  const productMonthRows = months12
    .map((k) => ({
      key: k,
      label: monthLabel(k),
      count: productsByMonth.get(k) ?? 0,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => (a.key < b.key ? 1 : -1));

  const reservationMonthRows = months12
    .map((k) => {
      const v = reservationsByMonth.get(k);
      return v
        ? {
            key: k,
            label: monthLabel(k),
            requested: v.requested,
            confirmed: v.confirmed,
            completed: v.completed,
            cancelled: v.cancelled,
          }
        : null;
    })
    .filter(Boolean) as Array<{
    key: string;
    label: string;
    requested: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  }>;

  const productIds = Array.from(new Set(completedMonthRows.map((r) => String(r.product_id)).filter(Boolean)));
  const pricingByProduct = new Map<string, { base_price: number | null; currency: string }>();

  if (productIds.length > 0) {
    const { data: pricingRows, error: pricingErr } = await supabase
      .from("product_supplier_pricing")
      .select("product_id,base_price,currency")
      .in("product_id", productIds);

    if (pricingErr) throw new Error(pricingErr.message);

    for (const p of pricingRows ?? []) {
      pricingByProduct.set(String((p as any).product_id), {
        base_price: (p as any).base_price === null ? null : Number((p as any).base_price),
        currency: String((p as any).currency ?? "USD").toUpperCase(),
      });
    }
  }

  const totalsByCcy = new Map<string, { units: number; total_revenue: number }>();
  const brandCurrencyAgg = new Map<string, { name: string; currency: string; units: number; revenue: number }>();

  for (const r of completedMonthRows) {
    const qty = qtyOr1((r as any).quantity);
    const pricing = pricingByProduct.get(String((r as any).product_id));
    const ccy = pricing?.currency ?? "USD";
    const base = pricing?.base_price ?? null;
    const totalRevenue = base === null ? 0 : base * qty;

    const totalByCcy = totalsByCcy.get(ccy) ?? { units: 0, total_revenue: 0 };
    totalByCcy.units += qty;
    totalByCcy.total_revenue += totalRevenue;
    totalsByCcy.set(ccy, totalByCcy);

    const brand =
      (r as any).products?.catalog_brands?.name_en ??
      ((r as any).products?.brand_id != null ? `#${(r as any).products.brand_id}` : "—");

    const brandCurrencyKey = `${brand}__${ccy}`;
    const brandAgg = brandCurrencyAgg.get(brandCurrencyKey) ?? {
      name: brand,
      currency: ccy,
      units: 0,
      revenue: 0,
    };
    brandAgg.units += qty;
    brandAgg.revenue += totalRevenue;
    brandCurrencyAgg.set(brandCurrencyKey, brandAgg);
  }

  const brandDistributionRows = Array.from(brandCurrencyAgg.values()).sort(
    (a, b) =>
      a.currency.localeCompare(b.currency) ||
      b.units - a.units ||
      b.revenue - a.revenue ||
      a.name.localeCompare(b.name)
  );

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <h1 className="h1">Dashboard</h1>
              <p className="p">Platform overview, monthly performance, brand distribution, and operational monitoring.</p>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Link className="btn" href="/admin/analytics">Analytics</Link>
              <Link className="btn" href="/admin/suppliers">Suppliers</Link>
              <Link className="btn" href="/admin/products">Products</Link>
            </div>
          </div>

          <div className="spacer" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="badge"><span>Active suppliers</span><span className="kbd">{activeSuppliers}</span></div>
            <div className="badge"><span>Active customers</span><span className="kbd">{activeCustomers}</span></div>
            <div className="badge"><span>Pending users</span><span className="kbd">{pendingUsers}</span></div>
            <div className="badge"><span>Total products</span><span className="kbd">{productsCount.count ?? 0}</span></div>
            <div className="badge"><span>Listed products</span><span className="kbd">{listedCount.count ?? 0}</span></div>
            <div className="badge"><span>Available units</span><span className="kbd">{availableUnits}</span></div>
            <div className="badge"><span>Products this month</span><span className="kbd">{productsCreatedThisMonthCount.count ?? 0}</span></div>
            <div className="badge"><span>Reservations this month</span><span className="kbd">{reservationsCreatedThisMonth}</span></div>
          </div>

          <div className="spacer" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="badge"><span>Requested</span><span className="kbd">{requestedQty}</span></div>
            <div className="badge"><span>Confirmed</span><span className="kbd">{confirmedQty}</span></div>
            <div className="badge"><span>Completed</span><span className="kbd">{completedQty}</span></div>
            <div className="badge"><span>Cancelled</span><span className="kbd">{cancelledQty}</span></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div style={{ fontWeight: 650, fontSize: 18 }}>Total Revenue</div>
          <p className="p">Completed reservations this month grouped by currency.</p>

          <div className="spacer" />

          {totalsByCcy.size === 0 ? (
            <p className="p">No completed sales this month yet.</p>
          ) : (
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              {Array.from(totalsByCcy.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([ccy, t]) => (
                  <div key={ccy} className="card" style={{ width: 340, flex: "1 1 340px" }}>
                    <div className="cardInner">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 650 }}>{ccy}</div>
                        <div className="badge"><span>Units</span><span className="kbd">{t.units}</span></div>
                      </div>
                      <div className="spacer" style={{ height: 10 }} />
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div className="p">Total revenue</div>
                        <div style={{ fontWeight: 650 }}>{money(ccy, t.total_revenue)}</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div style={{ fontWeight: 650, fontSize: 18 }}>Brand Distribution Revenue Total</div>
          <p className="p">Units sold and total revenue this month by brand and currency.</p>
          <div className="spacer" />

          {brandDistributionRows.length === 0 ? (
            <p className="p">—</p>
          ) : (
            <div style={{ maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
              <div className="row" style={{ flexDirection: "column", gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                  <div className="p" style={{ flex: "1 1 auto", minWidth: 0 }}>Brand</div>
                  <div className="p" style={{ width: 90, textAlign: "right" }}>Currency</div>
                  <div className="p" style={{ width: 90, textAlign: "right" }}>Units sold</div>
                  <div className="p" style={{ width: 170, textAlign: "right" }}>Total revenue</div>
                </div>

                <div className="hr" />

                {brandDistributionRows.map((r, i) => (
                  <div key={`${r.name}-${r.currency}-${i}`} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: "1 1 auto", minWidth: 0 }}>{r.name}</div>
                    <div className="p" style={{ width: 90, textAlign: "right" }}>{r.currency}</div>
                    <div className="p" style={{ width: 90, textAlign: "right" }}>{r.units}</div>
                    <div style={{ width: 170, textAlign: "right", fontWeight: 650 }}>
                      {money(r.currency, r.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "1 1 420px", minWidth: 0 }}>
          <div className="cardInner">
            <div style={{ fontWeight: 650, fontSize: 18 }}>Products Over Time</div>
            <p className="p">Last 12 months. Only months with created products are shown.</p>

            <div className="spacer" />

            {productMonthRows.length === 0 ? (
              <p className="p">No product creation history yet.</p>
            ) : (
              <div className="row" style={{ flexDirection: "column", gap: 8 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="p" style={{ width: 180 }}>Month</div>
                  <div className="p" style={{ width: 100, textAlign: "right" }}>Products listed</div>
                </div>

                <div className="hr" />

                {productMonthRows.map((r) => (
                  <div key={r.key} className="row" style={{ justifyContent: "space-between" }}>
                    <div style={{ width: 180 }}>{r.label}</div>
                    <div style={{ width: 100, textAlign: "right", fontWeight: 650 }}>{r.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ flex: "1 1 560px", minWidth: 0 }}>
          <div className="cardInner">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 650, fontSize: 18 }}>Reservations Over Time</div>
                <p className="p">Last 12 months grouped by reservation status.</p>
              </div>

              <div className="badge">
                <span>Reservations this month</span>
                <span className="kbd">{reservationsCreatedThisMonth}</span>
              </div>
            </div>

            <div className="spacer" />

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <div className="badge"><span>Requested</span><span className="kbd">{reservationsRequestedThisMonth}</span></div>
              <div className="badge"><span>Confirmed</span><span className="kbd">{reservationsConfirmedThisMonth}</span></div>
              <div className="badge"><span>Completed</span><span className="kbd">{reservationsCompletedThisMonth}</span></div>
              <div className="badge"><span>Cancelled</span><span className="kbd">{reservationsCancelledThisMonth}</span></div>
            </div>

            <div className="spacer" />

            {reservationMonthRows.length === 0 ? (
              <p className="p">No reservation history yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div className="row" style={{ flexDirection: "column", gap: 8, minWidth: 760 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div className="p" style={{ width: 160 }}>Month</div>
                    <div className="p" style={{ width: 110, textAlign: "right" }}>Requested</div>
                    <div className="p" style={{ width: 110, textAlign: "right" }}>Confirmed</div>
                    <div className="p" style={{ width: 110, textAlign: "right" }}>Completed</div>
                    <div className="p" style={{ width: 110, textAlign: "right" }}>Cancelled</div>
                  </div>

                  <div className="hr" />

                  {reservationMonthRows.map((r) => (
                    <div key={r.key} className="row" style={{ justifyContent: "space-between" }}>
                      <div style={{ width: 160 }}>{r.label}</div>
                      <div style={{ width: 110, textAlign: "right", fontWeight: 650 }}>{r.requested}</div>
                      <div style={{ width: 110, textAlign: "right", fontWeight: 650 }}>{r.confirmed}</div>
                      <div style={{ width: 110, textAlign: "right", fontWeight: 650 }}>{r.completed}</div>
                      <div style={{ width: 110, textAlign: "right", fontWeight: 650 }}>{r.cancelled}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}