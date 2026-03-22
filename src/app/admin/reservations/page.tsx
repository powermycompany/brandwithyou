import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type Row = {
  id: string;
  status: "requested" | "confirmed" | "completed" | "cancelled" | string;
  created_at: string;
  completed_at: string | null;
  quantity: number | null;
  product_id: string;
  supplier_id: string;
  customer_id: string;

  products:
    | {
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
        catalog_brands?: { name_en: string | null } | null;
        catalog_main_categories?: { name_en: string | null } | null;
        catalog_brand_subcategories?: { name_en: string | null } | null;
        catalog_product_types?: { name_en: string | null } | null;
      }
    | null;

  supplier:
    | {
        account_name: string | null;
        country: string | null;
      }
    | null;

  customer:
    | {
        account_name: string | null;
        email: string | null;
        country: string | null;
      }
    | null;
};

type PricingRow = {
  product_id: string;
  base_price: number | null;
  currency: string | null;
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

function qtyOr1(n: unknown) {
  const v = Number(n ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
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

function SummaryBlock({
  title,
  subtitle,
  items,
  metricLabel,
}: {
  title: string;
  subtitle: string;
  items: { label: string; count: number }[];
  metricLabel: string;
}) {
  return (
    <div
      className="card"
      style={{
        flex: "1 1 320px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.66) 100%)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(29,27,24,0.07)",
      }}
    >
      <div className="cardInner" style={{ padding: 18 }}>
        <div className="badge" style={{ marginBottom: 10 }}>
          <span>{title}</span>
          <span className="kbd">{subtitle}</span>
        </div>

        {items.length === 0 ? (
          <p className="p">No data available.</p>
        ) : (
          <div className="row" style={{ flexDirection: "column", gap: 8 }}>
            {items.slice(0, 8).map((item) => (
              <div
                key={item.label}
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
              >
                <div style={{ fontWeight: 550 }}>{item.label}</div>
                <div className="badge">
                  <span>{metricLabel}</span>
                  <span className="kbd">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function AdminReservationsPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,
      status,
      created_at,
      completed_at,
      quantity,
      product_id,
      supplier_id,
      customer_id,
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
      supplier:profiles!reservations_supplier_id_fkey(
        account_name,
        country
      ),
      customer:profiles!reservations_customer_id_fkey(
        account_name,
        email,
        country
      )
    `.trim()
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Row[];

  const productIds = Array.from(new Set(rows.map((r) => String(r.product_id)).filter(Boolean)));

  const pricingByProductId = new Map<string, { currency: string; unit_price: number | null }>();

  if (productIds.length > 0) {
    const { data: pricingRows, error: pricingErr } = await supabase
      .from("product_supplier_pricing")
      .select("product_id,base_price,currency")
      .in("product_id", productIds);

    if (pricingErr) throw new Error(pricingErr.message);

    for (const p of (pricingRows ?? []) as PricingRow[]) {
      pricingByProductId.set(String(p.product_id), {
        currency: String(p.currency ?? "USD").toUpperCase(),
        unit_price:
          p.base_price === null || p.base_price === undefined ? null : Number(p.base_price),
      });
    }
  }

  let requestedCount = 0;
  let confirmedCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;

  let requestedUnits = 0;
  let confirmedUnits = 0;
  let completedUnits = 0;
  let cancelledUnits = 0;

  const completedRevenueByCurrency = new Map<string, { units: number; revenue: number }>();
  const supplierCompletedUnitsMap = new Map<string, number>();
  const buyerCountryDemandMap = new Map<string, number>();
  const completedSalesCountryMap = new Map<string, number>();
  const brandDemandMap = new Map<string, number>();

  const supplierIds = new Set<string>();
  const customerIds = new Set<string>();

  for (const r of rows) {
    const qty = qtyOr1(r.quantity);
    const supplierName = safeText(r.supplier?.account_name) || safeText(r.supplier_id);
    const customerCountry = safeText(r.customer?.country) || "Unknown";
    const brand =
      safeText(r.products?.catalog_brands?.name_en) ||
      (r.products?.brand_id != null ? `#${r.products.brand_id}` : "—");

    supplierIds.add(String(r.supplier_id));
    customerIds.add(String(r.customer_id));

    if (r.status === "requested") {
      requestedCount += 1;
      requestedUnits += qty;
    }

    if (r.status === "confirmed") {
      confirmedCount += 1;
      confirmedUnits += qty;
    }

    if (r.status === "completed") {
      completedCount += 1;
      completedUnits += qty;

      supplierCompletedUnitsMap.set(
        supplierName,
        (supplierCompletedUnitsMap.get(supplierName) ?? 0) + qty
      );

      completedSalesCountryMap.set(
        customerCountry,
        (completedSalesCountryMap.get(customerCountry) ?? 0) + qty
      );

      const pricing = pricingByProductId.get(String(r.product_id));
      const ccy = pricing?.currency ?? String(r.products?.currency ?? "USD").toUpperCase();
      const unitPrice = pricing?.unit_price ?? null;
      const total = unitPrice === null ? 0 : unitPrice * qty;

      const current = completedRevenueByCurrency.get(ccy) ?? { units: 0, revenue: 0 };
      current.units += qty;
      current.revenue += total;
      completedRevenueByCurrency.set(ccy, current);
    }

    if (r.status === "cancelled") {
      cancelledCount += 1;
      cancelledUnits += qty;
    }

    if (r.status !== "cancelled") {
      buyerCountryDemandMap.set(
        customerCountry,
        (buyerCountryDemandMap.get(customerCountry) ?? 0) + 1
      );

      brandDemandMap.set(
        brand,
        (brandDemandMap.get(brand) ?? 0) + 1
      );
    }
  }

  const statusRows = [
    { label: "Requested", count: requestedCount },
    { label: "Confirmed", count: confirmedCount },
    { label: "Completed", count: completedCount },
    { label: "Cancelled", count: cancelledCount },
  ];

  const statusQtyRows = [
    { label: "Requested", count: requestedUnits },
    { label: "Confirmed", count: confirmedUnits },
    { label: "Completed", count: completedUnits },
    { label: "Cancelled", count: cancelledUnits },
  ];

  const supplierPerformanceRows = Array.from(supplierCompletedUnitsMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const buyerCountryDemandRows = Array.from(buyerCountryDemandMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const completedSalesCountryRows = Array.from(completedSalesCountryMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const brandDemandRows = Array.from(brandDemandMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const revenueCurrencyRows = Array.from(completedRevenueByCurrency.entries())
    .map(([currency, value]) => ({
      currency,
      units: value.units,
      revenue: value.revenue,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return (
    <div className="row" style={{ flexDirection: "column", gap: 16 }}>
      <div
        className="card"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.70) 100%)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        <div className="cardInner" style={{ padding: 24 }}>
          <h1 className="h1" style={{ marginBottom: 8 }}>
            Reservations
          </h1>
          <p className="p" style={{ fontSize: 15, lineHeight: 1.7 }}>
            Platform-wide reservation intelligence for monitoring lifecycle performance, supplier execution, buyer demand,
            completed sales flow, and brand-level interest across the full marketplace.
          </p>

          <div className="spacer" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="badge">
              <span>Total reservations</span>
              <span className="kbd">{rows.length}</span>
            </div>
            <div className="badge">
              <span>Requested</span>
              <span className="kbd">{requestedCount}</span>
            </div>
            <div className="badge">
              <span>Confirmed</span>
              <span className="kbd">{confirmedCount}</span>
            </div>
            <div className="badge">
              <span>Completed</span>
              <span className="kbd">{completedCount}</span>
            </div>
            <div className="badge">
              <span>Cancelled</span>
              <span className="kbd">{cancelledCount}</span>
            </div>
            <div className="badge">
              <span>Units sold</span>
              <span className="kbd">{completedUnits}</span>
            </div>
            <div className="badge">
              <span>Suppliers involved</span>
              <span className="kbd">{supplierIds.size}</span>
            </div>
            <div className="badge">
              <span>Customers involved</span>
              <span className="kbd">{customerIds.size}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <SummaryBlock
          title="Reservation Statuses"
          subtitle="Count"
          items={statusRows}
          metricLabel="Reservations"
        />
        <SummaryBlock
          title="Quantity by Status"
          subtitle="Volume"
          items={statusQtyRows}
          metricLabel="Units"
        />
      </div>

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <div
          className="card"
          style={{
            flex: "1 1 320px",
            background: "linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.66) 100%)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(29,27,24,0.07)",
          }}
        >
          <div className="cardInner" style={{ padding: 18 }}>
            <div className="badge" style={{ marginBottom: 10 }}>
              <span>Completed Revenue</span>
              <span className="kbd">By currency</span>
            </div>

            {revenueCurrencyRows.length === 0 ? (
              <p className="p">No completed sales yet.</p>
            ) : (
              <div className="row" style={{ flexDirection: "column", gap: 8 }}>
                {revenueCurrencyRows.map((r) => (
                  <div
                    key={r.currency}
                    className="row"
                    style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ fontWeight: 550 }}>{r.currency}</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <div className="badge">
                        <span>Units</span>
                        <span className="kbd">{r.units}</span>
                      </div>
                      <div className="badge">
                        <span>Revenue</span>
                        <span className="kbd">{money(r.currency, r.revenue)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SummaryBlock
          title="Supplier Performance"
          subtitle="Completed units"
          items={supplierPerformanceRows}
          metricLabel="Units"
        />
      </div>

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <SummaryBlock
          title="Buyer Countries"
          subtitle="Demand"
          items={buyerCountryDemandRows}
          metricLabel="Reservations"
        />
        <SummaryBlock
          title="Completed Sales by Country"
          subtitle="Units sold"
          items={completedSalesCountryRows}
          metricLabel="Units"
        />
      </div>

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <SummaryBlock
          title="Brand Demand"
          subtitle="Reservation interest"
          items={brandDemandRows}
          metricLabel="Reservations"
        />
      </div>

      <div
        className="card"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.66) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(29,27,24,0.07)",
        }}
      >
        <details>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              padding: 18,
            }}
          >
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
            >
              <div>
                <div style={{ fontWeight: 650, fontSize: 18 }}>Reservation Feed</div>
                <p className="p">
                  Collapsed by default. Open for full reservation-level inspection.
                </p>
              </div>

              <div className="badge">
                <span>Feed items</span>
                <span className="kbd">{rows.length}</span>
              </div>
            </div>
          </summary>

          <div className="cardInner" style={{ paddingTop: 0 }}>
            {rows.length === 0 ? (
              <p className="p">No reservations yet.</p>
            ) : (
              <div
                style={{
                  maxHeight: 780,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                <div className="row" style={{ flexDirection: "column", gap: 10 }}>
                  {rows.map((r) => {
                    const productName = r.products?.product_name ?? "Product";
                    const qty = qtyOr1(r.quantity);
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

                    const supplierName = r.supplier?.account_name ?? r.supplier_id;
                    const supplierCountry = r.supplier?.country ?? "—";
                    const customerName = r.customer?.account_name ?? r.customer_id;
                    const customerCountry = r.customer?.country ?? "—";

                    const pricing = pricingByProductId.get(String(r.product_id));
                    const ccy = pricing?.currency ?? String(r.products?.currency ?? "USD").toUpperCase();
                    const unitPrice = pricing?.unit_price ?? null;
                    const totalPrice = unitPrice === null ? null : unitPrice * qty;

                    return (
                      <div className="card" key={r.id}>
                        <div className="cardInner">
                          <div
                            className="row"
                            style={{
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 12,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ minWidth: 260, flex: "1 1 auto" }}>
                              <div style={{ fontWeight: 650 }}>{productName}</div>
                              <div className="p">{r.products?.reference_code ?? r.product_id}</div>
                              <div className="p">
                                Supplier: {supplierName} · {supplierCountry}
                              </div>
                              <div className="p">
                                Customer: {customerName}
                                {r.customer?.email ? ` · ${r.customer.email}` : ""}
                                {customerCountry ? ` · ${customerCountry}` : ""}
                              </div>
                              <div className="p">
                                Created: {d(r.created_at)} · Completed: {d(r.completed_at)}
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
                                <div className="badge">
                                  <span>Condition</span>
                                  <span className="kbd">{r.products?.condition ?? "—"}</span>
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
                              className="row"
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

                              <Link className="btn btnPrimary" href={`/product/${r.product_id}`}>
                                View product
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}