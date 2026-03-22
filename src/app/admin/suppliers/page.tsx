import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { adminUpdateSupplierMargin } from "@/server/actions/adminUpdateSupplierMargin";

function qtyOr1(n: unknown) {
  const v = Number(n ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function money(ccy: string, n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `${ccy.toUpperCase()} ${v}`;
}

function parseMonthParam(month?: string) {
  const raw = String(month ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  const [year, monthNum] = raw.split("-").map(Number);
  if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    };
  }

  return { year, month: monthNum };
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function previousMonth(year: number, month: number) {
  const d = new Date(year, month - 2, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function nextMonth(year: number, month: number) {
  const d = new Date(year, month, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

type SupplierRow = {
  id: string;
  account_name: string | null;
  email: string | null;
  country: string | null;
  status: string;
};

type RevenueByCurrencyRow = {
  currency: string;
  units: number;
  revenue: number;
  serviceFee: number;
};

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const { year, month } = parseMonthParam(params.month);

  const selectedMonthKey = monthKey(year, month);
  const selectedMonthLabel = monthLabel(year, month);

  const prev = previousMonth(year, month);
  const next = nextMonth(year, month);

  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toISOString();
  const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();

  const supabase = await supabaseServer();

  const [suppliersRes, productsRes, reservationsRes, marginsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,account_name,email,country,status")
      .eq("role", "supplier")
      .order("created_at", { ascending: false }),

    supabase
      .from("products")
      .select("id,supplier_id,status,quantity_available"),

    supabase
      .from("reservations")
      .select("id,supplier_id,status,quantity,completed_at,created_at,product_id"),

    supabase
      .from("supplier_margin_rules")
      .select("supplier_id,margin_pct"),
  ]);

  if (suppliersRes.error) throw new Error(suppliersRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (reservationsRes.error) throw new Error(reservationsRes.error.message);
  if (marginsRes.error) throw new Error(marginsRes.error.message);

  const suppliers = (suppliersRes.data ?? []) as SupplierRow[];
  const products = productsRes.data ?? [];
  const reservations = reservationsRes.data ?? [];
  const margins = marginsRes.data ?? [];

  const marginBySupplier = new Map<string, number>();
  for (const m of margins) {
    marginBySupplier.set(String((m as any).supplier_id), Number((m as any).margin_pct ?? 0));
  }

  const completedInSelectedMonth = reservations.filter((r: any) => {
    if (r.status !== "completed") return false;
    const ts = String(r.completed_at ?? r.created_at);
    return ts >= monthStart && ts < monthEnd;
  });

  const completedProductIds = Array.from(
    new Set(completedInSelectedMonth.map((r: any) => String(r.product_id)).filter(Boolean))
  );

  const pricingByProduct = new Map<string, { base_price: number | null; currency: string }>();

  if (completedProductIds.length > 0) {
    const { data: pricingRows, error: pricingErr } = await supabase
      .from("product_supplier_pricing")
      .select("product_id,base_price,currency")
      .in("product_id", completedProductIds);

    if (pricingErr) throw new Error(pricingErr.message);

    for (const p of pricingRows ?? []) {
      pricingByProduct.set(String((p as any).product_id), {
        base_price: (p as any).base_price === null ? null : Number((p as any).base_price),
        currency: String((p as any).currency ?? "USD").toUpperCase(),
      });
    }
  }

  const rows = suppliers.map((s) => {
    const supplierProducts = products.filter((p: any) => String(p.supplier_id) === String(s.id));
    const supplierReservations = reservations.filter((r: any) => String(r.supplier_id) === String(s.id));
    const supplierCompletedInSelectedMonth = completedInSelectedMonth.filter(
      (r: any) => String(r.supplier_id) === String(s.id)
    );

    const listedProducts = supplierProducts.filter((p: any) => p.status === "published").length;
    const totalProducts = supplierProducts.length;
    const availableUnits = supplierProducts.reduce((acc: number, p: any) => acc + Number(p.quantity_available ?? 0), 0);

    const requestedQty = supplierReservations
      .filter((r: any) => r.status === "requested")
      .reduce((acc: number, r: any) => acc + qtyOr1(r.quantity), 0);

    const confirmedQty = supplierReservations
      .filter((r: any) => r.status === "confirmed")
      .reduce((acc: number, r: any) => acc + qtyOr1(r.quantity), 0);

    const completedQty = supplierReservations
      .filter((r: any) => r.status === "completed")
      .reduce((acc: number, r: any) => acc + qtyOr1(r.quantity), 0);

    const monthCompletedQty = supplierCompletedInSelectedMonth.reduce(
      (acc: number, r: any) => acc + qtyOr1(r.quantity),
      0
    );

    const marginPct = marginBySupplier.get(String(s.id)) ?? 0;

    const revenueByCurrencyMap = new Map<string, RevenueByCurrencyRow>();

    for (const r of supplierCompletedInSelectedMonth) {
      const qty = qtyOr1((r as any).quantity);
      const pricing = pricingByProduct.get(String((r as any).product_id));
      const currency = pricing?.currency ?? "USD";
      const unitBase = pricing?.base_price ?? 0;
      const revenue = unitBase * qty;
      const serviceFee = revenue * (marginPct / 100);

      const current = revenueByCurrencyMap.get(currency) ?? {
        currency,
        units: 0,
        revenue: 0,
        serviceFee: 0,
      };

      current.units += qty;
      current.revenue += revenue;
      current.serviceFee += serviceFee;

      revenueByCurrencyMap.set(currency, current);
    }

    const revenueByCurrency = Array.from(revenueByCurrencyMap.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency)
    );

    return {
      ...s,
      totalProducts,
      listedProducts,
      availableUnits,
      requestedQty,
      confirmedQty,
      completedQty,
      monthCompletedQty,
      marginPct,
      revenueByCurrency,
    };
  });

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <h1 className="h1">Suppliers</h1>
          <p className="p">
            Manage supplier profiles, monthly revenue, manual margins, and invoiceable service fees by currency.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontWeight: 650, fontSize: 18 }}>Supplier Revenue</div>
              <p className="p">Monthly revenue and service fee overview by supplier and currency.</p>
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <Link className="btn" href={`/admin/suppliers?month=${monthKey(prev.year, prev.month)}`}>
                ←
              </Link>
              <div className="badge">
                <span>Month</span>
                <span className="kbd">{selectedMonthLabel}</span>
              </div>
              <Link className="btn" href={`/admin/suppliers?month=${monthKey(next.year, next.month)}`}>
                →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          {rows.length === 0 ? (
            <p className="p">No suppliers found.</p>
          ) : (
            <div className="row" style={{ flexDirection: "column", gap: 10 }}>
              {rows.map((s) => (
                <div key={s.id} className="card">
                  <div className="cardInner">
                    <div className="row" style={{ justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                      <div style={{ flex: "1 1 auto", minWidth: 260 }}>
                        <div style={{ fontWeight: 650, fontSize: 18 }}>{s.account_name ?? s.email ?? s.id}</div>
                        <div className="p">
                          {s.email ?? "—"} · {s.country ?? "—"}
                        </div>
                        <div className="p">Status: {s.status}</div>
                      </div>

                      <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <div className="badge"><span>Products</span><span className="kbd">{s.totalProducts}</span></div>
                        <div className="badge"><span>Listed</span><span className="kbd">{s.listedProducts}</span></div>
                        <div className="badge"><span>Available units</span><span className="kbd">{s.availableUnits}</span></div>
                        <div className="badge"><span>Requested</span><span className="kbd">{s.requestedQty}</span></div>
                        <div className="badge"><span>Confirmed</span><span className="kbd">{s.confirmedQty}</span></div>
                        <div className="badge"><span>Completed</span><span className="kbd">{s.completedQty}</span></div>
                      </div>
                    </div>

                    <div className="spacer" />

                    <div
                      style={{
                        borderRadius: 16,
                        border: "1px solid rgba(29,27,24,0.08)",
                        background: "rgba(255,255,255,0.42)",
                        padding: 14,
                      }}
                    >
                      <div
                        className="row"
                        style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                      >
                        <div>
                          <div style={{ fontWeight: 650 }}>
                            Revenue for {selectedMonthLabel}
                          </div>
                          <div className="p">Revenue and service fee are grouped by currency for accuracy.</div>
                        </div>

                        <form action={adminUpdateSupplierMargin} className="row" style={{ gap: 10, alignItems: "center" }}>
                          <input type="hidden" name="supplier_id" value={s.id} />
                          <label className="p" style={{ whiteSpace: "nowrap" }}>Margin %</label>
                          <input
                            className="input"
                            type="number"
                            name="margin_pct"
                            min="0"
                            step="0.01"
                            defaultValue={s.marginPct}
                            style={{ width: 110 }}
                          />
                          <button className="btn btnPrimary" type="submit">
                            Save
                          </button>
                        </form>
                      </div>

                      <div className="spacer" />

                      {s.revenueByCurrency.length === 0 ? (
                        <p className="p">No completed sales for {selectedMonthLabel}.</p>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <div className="row" style={{ flexDirection: "column", gap: 8, minWidth: 760 }}>
                            <div className="row" style={{ justifyContent: "space-between" }}>
                              <div className="p" style={{ width: 120 }}>Currency</div>
                              <div className="p" style={{ width: 90, textAlign: "right" }}>Units</div>
                              <div className="p" style={{ width: 180, textAlign: "right" }}>Revenue</div>
                              <div className="p" style={{ width: 110, textAlign: "right" }}>Margin</div>
                              <div className="p" style={{ width: 180, textAlign: "right" }}>Service fee</div>
                            </div>

                            <div className="hr" />

                            {s.revenueByCurrency.map((r) => (
                              <div key={`${s.id}-${selectedMonthKey}-${r.currency}`} className="row" style={{ justifyContent: "space-between" }}>
                                <div style={{ width: 120, fontWeight: 650 }}>{r.currency}</div>
                                <div style={{ width: 90, textAlign: "right" }}>{r.units}</div>
                                <div style={{ width: 180, textAlign: "right", fontWeight: 650 }}>
                                  {money(r.currency, r.revenue)}
                                </div>
                                <div style={{ width: 110, textAlign: "right" }}>{s.marginPct}%</div>
                                <div style={{ width: 180, textAlign: "right", fontWeight: 650 }}>
                                  {money(r.currency, r.serviceFee)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}