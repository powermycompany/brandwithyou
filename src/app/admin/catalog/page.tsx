import { supabaseServer } from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  product_name: string | null;
  reference_code: string | null;
  status: string;
  quantity_available: number | null;
  created_at: string;
  supplier_id: string;
  catalog_brands?: { name_en: string | null } | null;
  catalog_main_categories?: { name_en: string | null } | null;
  catalog_brand_subcategories?: { name_en: string | null } | null;
  catalog_product_types?: { name_en: string | null } | null;
  supplier?: { country: string | null } | null;
};

type PricingRow = {
  product_id: string;
  currency: string | null;
};

type DemandRow = {
  status: string;
  product_id: string | null;
  quantity: number | null;
  customer?: { country: string | null } | null;
};

function safeText(v: unknown) {
  return String(v ?? "").trim();
}

function qtyOr1(n: unknown) {
  const v = Number(n ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function summarizeCounts(items: string[]) {
  const map = new Map<string, number>();

  for (const item of items) {
    const key = safeText(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function summarizeUniqueSuppliersByCountry(rows: ProductRow[]) {
  const map = new Map<string, Set<string>>();

  for (const row of rows) {
    const country = safeText(row.supplier?.country) || "Unknown";
    const supplierId = safeText(row.supplier_id);
    if (!supplierId) continue;

    const current = map.get(country) ?? new Set<string>();
    current.add(supplierId);
    map.set(country, current);
  }

  return Array.from(map.entries())
    .map(([label, supplierIds]) => ({ label, count: supplierIds.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function summarizeCompletedUnitsByCountry(rows: DemandRow[]) {
  const map = new Map<string, number>();

  for (const row of rows) {
    const country = safeText(row.customer?.country) || "Unknown";
    const qty = qtyOr1(row.quantity);
    map.set(country, (map.get(country) ?? 0) + qty);
  }

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
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

export default async function AdminCatalogPage() {
  const supabase = await supabaseServer();

  const demandSince = new Date();
  demandSince.setDate(demandSince.getDate() - 180);

  const [productsRes, reservationsRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        `
        id,
        product_name,
        reference_code,
        status,
        quantity_available,
        created_at,
        supplier_id,
        catalog_brands(name_en),
        catalog_main_categories(name_en),
        catalog_brand_subcategories(name_en),
        catalog_product_types(name_en),
        supplier:profiles!products_supplier_id_fkey(country)
      `.trim()
      )
      .eq("status", "published")
      .order("created_at", { ascending: false }),

    supabase
      .from("reservations")
      .select(
        `
        status,
        product_id,
        quantity,
        customer:profiles!reservations_customer_id_fkey(country)
      `.trim()
      )
      .gte("created_at", demandSince.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (productsRes.error) throw new Error(productsRes.error.message);
  if (reservationsRes.error) throw new Error(reservationsRes.error.message);

  const rows = (productsRes.data ?? []) as ProductRow[];
  const reservationRows = (reservationsRes.data ?? []) as DemandRow[];

  const publishedProductIds = rows.map((r) => r.id).filter(Boolean);

  let livePricingRows: PricingRow[] = [];
  if (publishedProductIds.length > 0) {
    const { data, error } = await supabase
      .from("product_supplier_pricing")
      .select("product_id,currency")
      .in("product_id", publishedProductIds);

    if (error) throw new Error(error.message);
    livePricingRows = (data ?? []) as PricingRow[];
  }

  const completedReservationRows = reservationRows.filter((r) => safeText(r.status) === "completed");
  const demandReservationRows = reservationRows.filter((r) => safeText(r.status) !== "cancelled");

  const soldProductIds = Array.from(
    new Set(completedReservationRows.map((r) => safeText(r.product_id)).filter(Boolean))
  );

  let soldPricingRows: PricingRow[] = [];
  if (soldProductIds.length > 0) {
    const { data, error } = await supabase
      .from("product_supplier_pricing")
      .select("product_id,currency")
      .in("product_id", soldProductIds);

    if (error) throw new Error(error.message);
    soldPricingRows = (data ?? []) as PricingRow[];
  }

  const brandSummary = summarizeCounts(rows.map((r) => safeText(r.catalog_brands?.name_en)));
  const categorySummary = summarizeCounts(rows.map((r) => safeText(r.catalog_main_categories?.name_en)));
  const supplierCountrySummary = summarizeUniqueSuppliersByCountry(rows);

  const liveCurrencySummary = summarizeCounts(
    livePricingRows.map((r) => safeText(r.currency).toUpperCase())
  );

  const soldCurrencySummary = summarizeCounts(
    soldPricingRows.map((r) => safeText(r.currency).toUpperCase())
  );

  const buyerCountryDemandSummary = summarizeCounts(
    demandReservationRows.map((r) => safeText(r.customer?.country))
  );

  const completedSalesCountrySummary = summarizeCompletedUnitsByCountry(completedReservationRows);

  const totalAvailableUnits = rows.reduce(
    (sum, r) => sum + Math.max(0, Number(r.quantity_available ?? 0)),
    0
  );

  const completedSalesCount = completedReservationRows.length;
  const productsSoldCount = soldProductIds.length;
  const unitsSoldCount = completedReservationRows.reduce(
    (sum, r) => sum + qtyOr1(r.quantity),
    0
  );

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
            Catalog
          </h1>
          <p className="p" style={{ fontSize: 15, lineHeight: 1.7 }}>
            A catalog intelligence layer built from the live published portfolio and buyer activity. Use this to
            understand brand depth, category mix, supplier geography, active currencies, demand by buyer country, and completed sales distribution.
          </p>
        </div>
      </div>

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <SummaryBlock
          title="Featured Brands"
          subtitle="Live portfolio"
          items={brandSummary}
          metricLabel="Products"
        />
        <SummaryBlock
          title="Featured Categories"
          subtitle="Live portfolio"
          items={categorySummary}
          metricLabel="Products"
        />
      </div>

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <SummaryBlock
          title="Supplier Countries"
          subtitle="Coverage"
          items={supplierCountrySummary}
          metricLabel="Suppliers"
        />
        <SummaryBlock
          title="Live Portfolio Currencies"
          subtitle="Published products"
          items={liveCurrencySummary}
          metricLabel="Products"
        />
      </div>

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <SummaryBlock
          title="Sold Currencies"
          subtitle="Completed sales"
          items={soldCurrencySummary}
          metricLabel="Products"
        />
        <SummaryBlock
          title="Buyer Countries"
          subtitle="Demand"
          items={buyerCountryDemandSummary}
          metricLabel="Reservations"
        />
      </div>

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <SummaryBlock
          title="Completed Sales by Country"
          subtitle="Units sold"
          items={completedSalesCountrySummary}
          metricLabel="Units"
        />
      </div>
    </div>
  );
}