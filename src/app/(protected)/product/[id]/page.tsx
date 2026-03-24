import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { requestReservation } from "@/server/actions/requestReservation";
import ProductImagesGallery from "@/components/product/ProductImagesGallery";

type Params = { id: string };

function money(ccy: string, n: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `${String(ccy ?? "USD").toUpperCase()} ${v}`;
}

function safeText(v: unknown) {
  return String(v ?? "").trim();
}

function hasMeaningfulText(v: unknown) {
  const s = String(v ?? "").trim();
  return s !== "" && s !== "-" && s !== "—";
}

function normalizeGender(v: unknown): "men" | "women" | "unisex" | "" {
  const x = safeText(v).toLowerCase();
  if (x === "men" || x === "male" || x === "man") return "men";
  if (x === "women" || x === "female" || x === "woman") return "women";
  if (x === "unisex") return "unisex";
  return "";
}

function genderLabel(v: unknown) {
  const g = normalizeGender(v);
  if (g === "men") return "Men";
  if (g === "women") return "Women";
  if (g === "unisex") return "Unisex";
  return "—";
}

export default async function ProductDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id ?? null;

  const { data: profile, error: profErr } = uid
    ? await supabase.from("profiles").select("id,status,role").eq("id", uid).maybeSingle()
    : ({ data: null, error: null } as any);
  if (profErr) throw new Error(profErr.message);

  const { data: pr, error: prErr } = await supabase
    .from("products")
    .select(
      `
      id,
      product_name,
      reference_code,
      serial_number,
      gender,
      condition,
      status,
      currency,
      color,
      material,
      hardware_details,
      size_specs,
      description,
      quantity_available,
      supplier_id,
      main_category_id,
      brand_id,
      brand_subcategory_id,
      product_type_id,
      catalog_main_categories(name_en),
      catalog_brands(name_en),
      catalog_brand_subcategories(name_en),
      catalog_product_types(name_en)
    `.trim()
    )
    .eq("id", id)
    .maybeSingle();

  if (prErr) throw new Error(prErr.message);

  if (!pr) {
    return (
      <div className="card">
        <div className="cardInner">
          <div className="badge">
            <span>Error</span>
            <span className="kbd">Not found</span>
          </div>
        </div>
      </div>
    );
  }

  const { data: pricing, error: priceErr } = await supabase
    .rpc("get_market_product_pricing", { p_product_id: id })
    .maybeSingle();

  if (priceErr) throw new Error(priceErr.message);

  const final = pricing ? Number((pricing as any).final_price) : null;

  const ccy =
    pricing && (pricing as any).currency
      ? String((pricing as any).currency).toUpperCase()
      : String(((pr as any).currency ?? "USD")).toUpperCase();

  const isActiveCustomer = !!profile && profile.status === "active" && profile.role === "customer";
  const isListed = (pr as any).status === "published";
  const avail = Math.max(0, Number((pr as any).quantity_available ?? 0));

  const cat = (pr as any).catalog_main_categories?.name_en ?? `#${(pr as any).main_category_id}`;
  const brand = (pr as any).catalog_brands?.name_en ?? `#${(pr as any).brand_id}`;
  const sub = (pr as any).catalog_brand_subcategories?.name_en ?? `#${(pr as any).brand_subcategory_id}`;
  const type = (pr as any).catalog_product_types?.name_en ?? `#${(pr as any).product_type_id}`;

  return (
    <div className="row" style={{ flexDirection: "column", gap: 16 }}>
      <div className="row productDetailBackRow" style={{ justifyContent: "flex-end" }}>
        <Link
          href="/luxe-atelier"
          className="btn productDetailBackButton"
          style={{
            height: 42,
            borderRadius: 14,
            padding: "0 16px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Back to Luxe Atelier
        </Link>
      </div>

      <ProductImagesGallery productId={(pr as any).id} />

      <div
        className="card"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.66) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(29,27,24,0.07)",
          boxShadow: "0 16px 34px rgba(78,64,42,0.08)",
        }}
      >
        <div className="cardInner" style={{ padding: 20 }}>
          <div
            className="row productDetailHeaderRow"
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div className="productDetailTitleWrap" style={{ minWidth: 0, flex: "1 1 420px" }}>
              <h1
                className="h1"
                style={{
                  margin: 0,
                  fontSize: 24,
                  lineHeight: 1.2,
                  letterSpacing: "0.01em",
                }}
              >
                {(pr as any).product_name || "Product"}
              </h1>
            </div>

            <div className="productDetailPriceWrap" style={{ textAlign: "right", flex: "0 0 auto", minWidth: 160 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 24,
                  letterSpacing: "0.01em",
                }}
              >
                {money(ccy, final)}
              </div>
            </div>
          </div>

          <div className="spacer" style={{ height: 14 }} />

          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div className="badge">
              <span>Brand</span>
              <span className="kbd">{safeText(brand) || "—"}</span>
            </div>
            <div className="badge">
              <span>Subcategory</span>
              <span className="kbd">{safeText(sub) || "—"}</span>
            </div>
            <div className="badge">
              <span>Product type</span>
              <span className="kbd">{safeText(type) || "—"}</span>
            </div>
            <div className="badge">
              <span>Main category</span>
              <span className="kbd">{safeText(cat) || "—"}</span>
            </div>
          </div>

          <div className="spacer" style={{ height: 10 }} />

          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div className="badge">
              <span>Status</span>
              <span className="kbd">{isListed ? "Listed" : "Delisted"}</span>
            </div>

            <div className="badge">
              <span>Available</span>
              <span className="kbd">{isListed ? String(avail) : "0"}</span>
            </div>

            <div className="badge">
              <span>Condition</span>
              <span className="kbd">{safeText((pr as any).condition) || "—"}</span>
            </div>

            {hasMeaningfulText((pr as any).reference_code) ? (
              <div className="badge">
                <span>Product No.</span>
                <span className="kbd">{safeText((pr as any).reference_code)}</span>
              </div>
            ) : null}

            {hasMeaningfulText((pr as any).serial_number) ? (
              <div className="badge">
                <span>Serial</span>
                <span className="kbd">{safeText((pr as any).serial_number)}</span>
              </div>
            ) : null}

            <div className="badge">
              <span>Gender</span>
              <span className="kbd">{genderLabel((pr as any).gender)}</span>
            </div>

            {hasMeaningfulText((pr as any).color) ? (
              <div className="badge">
                <span>Color</span>
                <span className="kbd">{safeText((pr as any).color)}</span>
              </div>
            ) : null}

            {hasMeaningfulText((pr as any).material) ? (
              <div className="badge">
                <span>Material</span>
                <span className="kbd">{safeText((pr as any).material)}</span>
              </div>
            ) : null}

            {hasMeaningfulText((pr as any).hardware_details) ? (
              <div className="badge">
                <span>Hardware</span>
                <span className="kbd">{safeText((pr as any).hardware_details)}</span>
              </div>
            ) : null}

            {hasMeaningfulText((pr as any).size_specs) ? (
              <div className="badge">
                <span>Size / Specs</span>
                <span className="kbd">{safeText((pr as any).size_specs)}</span>
              </div>
            ) : null}
          </div>

          <div className="spacer" style={{ height: 16 }} />

          <div
            className="card"
            style={{
              background: "rgba(255,255,255,0.58)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              minHeight: safeText((pr as any).description) ? 0 : 140,
            }}
          >
            <div className="cardInner" style={{ padding: 18 }}>
              <div className="badge" style={{ marginBottom: 10 }}>
                <span>Description</span>
              </div>

              <p className="p" style={{ lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0 }}>
                {safeText((pr as any).description) || "No description provided for this product."}
              </p>
            </div>
          </div>

          <div className="spacer" style={{ height: 16 }} />

          <div
            className="row productDetailActionRow"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div className="badge">
              <span>Reservation</span>
              <span className="kbd">{isListed && avail > 0 ? "Available" : "Unavailable"}</span>
            </div>

            {isActiveCustomer && isListed && avail > 0 ? (
              <form
                action={requestReservation}
                className="row productDetailReserveForm"
                style={{
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "nowrap",
                  marginLeft: "auto",
                }}
              >
                <input type="hidden" name="product_id" value={(pr as any).id} />

                <select
                  className="input productDetailQty"
                  name="quantity"
                  defaultValue="1"
                  required
                  style={{
                    width: 88,
                    height: 42,
                    padding: "0 10px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.70)",
                  }}
                >
                  {Array.from({ length: Math.min(avail, 20) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <button
                  className="btn btnPrimary productDetailReserveButton"
                  type="submit"
                  style={{
                    height: 42,
                    borderRadius: 14,
                    minWidth: 118,
                    padding: "0 16px",
                    boxShadow: "0 10px 24px rgba(31,29,26,0.10)",
                  }}
                >
                  Reserve
                </button>
              </form>
            ) : (
              <div className="badge productDetailReserveBadge" style={{ marginLeft: "auto" }}>
                <span>Reserve</span>
                <span className="kbd">
                  {!uid
                    ? "Login required"
                    : !isActiveCustomer
                    ? "Customers only"
                    : !isListed
                    ? "Not listed"
                    : "Out of stock"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}