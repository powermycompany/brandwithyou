import { supabaseServer } from "@/lib/supabase/server";

function lastNMonthsKeys(n: number) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, 1);
  return dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function qtyOr1(n: unknown) {
  const v = Number(n ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function money(ccy: string, n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `${ccy.toUpperCase()} ${v}`;
}

type ProfileRow = {
  id: string;
  account_name: string | null;
  country: string | null;
  status: string | null;
  role: string | null;
};

type CompletedRow = {
  id: string;
  quantity: number | null;
  completed_at: string | null;
  created_at: string;
  supplier_id: string;
  product_id: string;
};

type MarginRow = {
  supplier_id: string;
  margin_pct: number | null;
};

type PricingRow = {
  product_id: string;
  base_price: number | null;
  currency: string | null;
};

type SupplierCurrencyRow = {
  supplier_id: string;
  name: string;
  country: string;
  currency: string;
  units: number;
  supplier_revenue: number;
  customer_revenue: number;
};

type MonthlyCurrencyRow = {
  key: string;
  label: string;
  currency: string;
  units: number;
  supplier_revenue: number;
  customer_revenue: number;
};

type TotalsByCurrencyRow = {
  currency: string;
  units: number;
  supplier_revenue: number;
  customer_revenue: number;
};

export default async function AdminAnalyticsPage() {
  const supabase = await supabaseServer();

  const months12 = lastNMonthsKeys(12);
  const oldestKey = months12[0];
  const sinceIso = `${oldestKey}-01T00:00:00.000Z`;

  const [profilesRes, completedRes, marginsRes] = await Promise.all([
    supabase.from("profiles").select("id,account_name,country,status,role"),
    supabase
      .from("reservations")
      .select("id,quantity,completed_at,created_at,supplier_id,product_id")
      .eq("status", "completed")
      .gte("completed_at", sinceIso)
      .order("completed_at", { ascending: false }),
    supabase.from("supplier_margin_rules").select("supplier_id,margin_pct"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (completedRes.error) throw new Error(completedRes.error.message);
  if (marginsRes.error) throw new Error(marginsRes.error.message);

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const completedRows = (completedRes.data ?? []) as CompletedRow[];
  const margins = (marginsRes.data ?? []) as MarginRow[];

  const profileById = new Map<string, ProfileRow>();
  for (const p of profiles) {
    profileById.set(String(p.id), p);
  }

  const marginBySupplier = new Map<string, number>();
  for (const m of margins) {
    marginBySupplier.set(String(m.supplier_id), Number(m.margin_pct ?? 0));
  }

  const productIds = Array.from(new Set(completedRows.map((r) => String(r.product_id)).filter(Boolean)));

  const pricingByProduct = new Map<string, { base_price: number | null; currency: string }>();
  if (productIds.length > 0) {
    const { data: pricingRows, error: priceErr } = await supabase
      .from("product_supplier_pricing")
      .select("product_id,base_price,currency")
      .in("product_id", productIds);

    if (priceErr) throw new Error(priceErr.message);

    for (const p of (pricingRows ?? []) as PricingRow[]) {
      pricingByProduct.set(String(p.product_id), {
        base_price: p.base_price === null ? null : Number(p.base_price),
        currency: String(p.currency ?? "USD").toUpperCase(),
      });
    }
  }

  const totalsByCurrency = new Map<string, TotalsByCurrencyRow>();
  const supplierTotals = new Map<string, SupplierCurrencyRow>();
  const monthlyTotals = new Map<string, MonthlyCurrencyRow>();

  let totalCompletedReservations = 0;
  let totalUnits = 0;

  for (const r of completedRows) {
    const qty = qtyOr1(r.quantity);
    const supplierId = String(r.supplier_id);
    const mk = monthKey(String(r.completed_at ?? r.created_at));

    const profile = profileById.get(supplierId);
    const name = profile?.account_name ?? supplierId;
    const country = profile?.country ?? "—";

    const pricing = pricingByProduct.get(String(r.product_id));
    const base = pricing?.base_price ?? null;
    const currency = pricing?.currency ?? "USD";
    const marginPct = marginBySupplier.get(supplierId) ?? 0;

    const supplierRevenue = base === null ? 0 : base * qty;
    const customerUnit = base === null ? null : Math.round(base * (1 + marginPct / 100) * 100) / 100;
    const customerRevenue = customerUnit === null ? 0 : customerUnit * qty;

    totalCompletedReservations += 1;
    totalUnits += qty;

    const currencyAgg = totalsByCurrency.get(currency) ?? {
      currency,
      units: 0,
      supplier_revenue: 0,
      customer_revenue: 0,
    };
    currencyAgg.units += qty;
    currencyAgg.supplier_revenue += supplierRevenue;
    currencyAgg.customer_revenue += customerRevenue;
    totalsByCurrency.set(currency, currencyAgg);

    const supplierKey = `${supplierId}__${currency}`;
    const supplierAgg = supplierTotals.get(supplierKey) ?? {
      supplier_id: supplierId,
      name,
      country,
      currency,
      units: 0,
      supplier_revenue: 0,
      customer_revenue: 0,
    };
    supplierAgg.units += qty;
    supplierAgg.supplier_revenue += supplierRevenue;
    supplierAgg.customer_revenue += customerRevenue;
    supplierTotals.set(supplierKey, supplierAgg);

    const monthCurrencyKey = `${mk}__${currency}`;
    const monthAgg = monthlyTotals.get(monthCurrencyKey) ?? {
      key: mk,
      label: monthLabel(mk),
      currency,
      units: 0,
      supplier_revenue: 0,
      customer_revenue: 0,
    };
    monthAgg.units += qty;
    monthAgg.supplier_revenue += supplierRevenue;
    monthAgg.customer_revenue += customerRevenue;
    monthlyTotals.set(monthCurrencyKey, monthAgg);
  }

  const totalsByCurrencyRows = Array.from(totalsByCurrency.values()).sort((a, b) =>
    a.currency.localeCompare(b.currency)
  );

  const supplierRows = Array.from(supplierTotals.values()).sort(
    (a, b) =>
      a.currency.localeCompare(b.currency) ||
      b.customer_revenue - a.customer_revenue ||
      b.units - a.units ||
      a.name.localeCompare(b.name)
  );

  const monthlyRows = Array.from(monthlyTotals.values()).sort(
    (a, b) =>
      (a.key < b.key ? 1 : -1) ||
      a.currency.localeCompare(b.currency)
  );

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <h1 className="h1">Analytics</h1>
          <p className="p">
            Monthly sales performance and supplier analytics across the last 12 months. Revenue is grouped by currency for accuracy.
          </p>

          <div className="spacer" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="badge">
              <span>Completed sales</span>
              <span className="kbd">{totalCompletedReservations}</span>
            </div>
            <div className="badge">
              <span>Units sold</span>
              <span className="kbd">{totalUnits}</span>
            </div>
            <div className="badge">
              <span>Currencies</span>
              <span className="kbd">{totalsByCurrencyRows.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div style={{ fontWeight: 650, fontSize: 18 }}>Revenue totals by currency</div>
          <p className="p">Completed sales across the tracked period, separated by currency.</p>

          <div className="spacer" />

          {totalsByCurrencyRows.length === 0 ? (
            <p className="p">No completed sales found.</p>
          ) : (
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              {totalsByCurrencyRows.map((r) => (
                <div key={r.currency} className="card" style={{ width: 360, flex: "1 1 360px" }}>
                  <div className="cardInner">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 650, fontSize: 18 }}>{r.currency}</div>
                      <div className="badge">
                        <span>Units</span>
                        <span className="kbd">{r.units}</span>
                      </div>
                    </div>

                    <div className="spacer" style={{ height: 10 }} />

                    <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                      <div className="p">Supplier revenue</div>
                      <div style={{ fontWeight: 650 }}>{money(r.currency, r.supplier_revenue)}</div>
                    </div>

                    <div className="spacer" style={{ height: 6 }} />

                    <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                      <div className="p">Customer revenue</div>
                      <div style={{ fontWeight: 650 }}>{money(r.currency, r.customer_revenue)}</div>
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
          <div style={{ fontWeight: 650, fontSize: 18 }}>Monthly performance (last 12 months)</div>
          <p className="p">Completed sales grouped by month and currency.</p>

          <div className="spacer" />

          {monthlyRows.length === 0 ? (
            <p className="p">No monthly sales data found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div className="row" style={{ flexDirection: "column", gap: 8, minWidth: 920 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                  <div className="p" style={{ width: 180 }}>Month</div>
                  <div className="p" style={{ width: 100 }}>Currency</div>
                  <div className="p" style={{ width: 100, textAlign: "right" }}>Units</div>
                  <div className="p" style={{ width: 180, textAlign: "right" }}>Supplier revenue</div>
                  <div className="p" style={{ width: 180, textAlign: "right" }}>Customer revenue</div>
                </div>

                <div className="hr" />

                {monthlyRows.map((r) => (
                  <div key={`${r.key}-${r.currency}`} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                    <div style={{ width: 180 }}>{r.label}</div>
                    <div style={{ width: 100 }}>{r.currency}</div>
                    <div style={{ width: 100, textAlign: "right" }}>{r.units}</div>
                    <div style={{ width: 180, textAlign: "right", fontWeight: 650 }}>
                      {money(r.currency, r.supplier_revenue)}
                    </div>
                    <div style={{ width: 180, textAlign: "right", fontWeight: 650 }}>
                      {money(r.currency, r.customer_revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardInner">
          <div style={{ fontWeight: 650, fontSize: 18 }}>Supplier performance</div>
          <p className="p">How much each supplier sold across the tracked period, grouped by currency.</p>

          <div className="spacer" />

          {supplierRows.length === 0 ? (
            <p className="p">No completed sales found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div className="row" style={{ flexDirection: "column", gap: 8, minWidth: 980 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                  <div className="p" style={{ flex: "1 1 220px" }}>Supplier</div>
                  <div className="p" style={{ width: 140 }}>Country</div>
                  <div className="p" style={{ width: 100 }}>Currency</div>
                  <div className="p" style={{ width: 90, textAlign: "right" }}>Units</div>
                  <div className="p" style={{ width: 180, textAlign: "right" }}>Supplier rev.</div>
                  <div className="p" style={{ width: 180, textAlign: "right" }}>Customer rev.</div>
                </div>

                <div className="hr" />

                {supplierRows.map((r) => (
                  <div key={`${r.supplier_id}-${r.currency}`} className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: "1 1 220px" }}>{r.name}</div>
                    <div style={{ width: 140 }}>{r.country}</div>
                    <div style={{ width: 100 }}>{r.currency}</div>
                    <div style={{ width: 90, textAlign: "right" }}>{r.units}</div>
                    <div style={{ width: 180, textAlign: "right", fontWeight: 650 }}>
                      {money(r.currency, r.supplier_revenue)}
                    </div>
                    <div style={{ width: 180, textAlign: "right", fontWeight: 650 }}>
                      {money(r.currency, r.customer_revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}