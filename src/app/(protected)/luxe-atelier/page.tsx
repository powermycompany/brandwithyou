"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { requestReservation } from "@/server/actions/requestReservation";
import type { MarketProductRow } from "@/server/queries/productSearch";
import { getLocale, labelByLocale } from "@/lib/i18n";

type SortKey =
  | "newest"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc";

type GenderFilter = "all" | "men" | "women" | "unisex";

type ProductImageRow = {
  id: string;
  product_id: string;
  storage_path: string;
  created_at: string;
};

type ProductExtraRow = {
  id: string;
  created_at: string | null;
  quantity_available: number | null;
  supplier_id: string | null;
  gender: string | null;
  brand_subcategory_id: number | null;
  supplier:
    | {
        country: string | null;
      }
    | null;
  catalog_brand_subcategories?:
    | {
        name_en: string | null;
      }
    | null;
};

type ProfileLite = {
  id: string;
  status: "pending" | "active" | null;
  role: "admin" | "supplier" | "customer" | null;
};

type MarketRow = MarketProductRow & {
  supplier_country?: string | null;
  created_at?: string | null;
  quantity_available?: number | null;
  product_image_url?: string | null;
  gender?: string | null;
  brand_subcategory_id?: number | null;
  brand_subcategory_en?: string | null;
};

function money(ccy: string | null | undefined, n: number | string | null | undefined) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  const rounded = Math.round(num * 100) / 100;
  return `${String(ccy ?? "USD").toUpperCase()} ${rounded}`;
}

function safeText(v: unknown) {
  return String(v ?? "").trim();
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

export default function LuxeAtelierPage() {
  const supabase = supabaseBrowser();

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<MarketRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState(getLocale());
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  const [conditionFilter, setConditionFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  useEffect(() => {
    const h = () => setLocale(getLocale());
    window.addEventListener("bw_locale_change", h);
    return () => window.removeEventListener("bw_locale_change", h);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!alive) return;

      if (!uid) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id,status,role")
        .eq("id", uid)
        .maybeSingle();

      if (!alive) return;
      setProfile((data ?? null) as ProfileLite | null);
    })();

    return () => {
      alive = false;
    };
  }, [supabase]);

  async function runSearch(query: string) {
    setBusy(true);
    setErr(null);

    const { data, error } = await supabase.rpc("search_market_products", {
      p_query: query,
      p_brand_id: null,
      p_category_id: null,
      p_condition: null,
    });

    if (error) {
      setBusy(false);
      setErr(error.message);
      setRows([]);
      return;
    }

    const baseRows = ((data ?? []) as MarketProductRow[]).map((r) => ({
      ...(r as MarketProductRow),
    })) as MarketRow[];

    const ids = baseRows.map((r) => String(r.id)).filter(Boolean);

    if (ids.length === 0) {
      setRows([]);
      setBusy(false);
      return;
    }

    const { data: extrasRaw, error: extrasError } = await supabase
      .from("products")
      .select(
        `
        id,
        created_at,
        quantity_available,
        supplier_id,
        gender,
        brand_subcategory_id,
        supplier:profiles!products_supplier_id_fkey(
          country
        ),
        catalog_brand_subcategories(
          name_en
        )
      `.trim()
      )
      .in("id", ids);

    if (extrasError) {
      setBusy(false);
      setErr(extrasError.message);
      setRows([]);
      return;
    }

    const extras = (extrasRaw ?? []) as ProductExtraRow[];
    const extrasById = new Map<string, ProductExtraRow>();
    for (const r of extras) {
      extrasById.set(String(r.id), r);
    }

    const { data: imageRowsRaw, error: imageError } = await supabase
      .from("product_images")
      .select("id,product_id,storage_path,created_at")
      .in("product_id", ids)
      .order("created_at", { ascending: true });

    if (imageError) {
      setBusy(false);
      setErr(imageError.message);
      setRows([]);
      return;
    }

    const imageRows = (imageRowsRaw ?? []) as ProductImageRow[];

    const firstImageByProductId = new Map<string, ProductImageRow>();
    for (const img of imageRows) {
      const pid = String(img.product_id);
      if (!firstImageByProductId.has(pid)) {
        firstImageByProductId.set(pid, img);
      }
    }

    const signedUrlByProductId = new Map<string, string>();
    await Promise.all(
      Array.from(firstImageByProductId.entries()).map(async ([productId, img]) => {
        const { data: signed, error: signedError } = await supabase.storage
          .from("product-images")
          .createSignedUrl(img.storage_path, 60 * 60);

        if (!signedError && signed?.signedUrl) {
          signedUrlByProductId.set(productId, signed.signedUrl);
        }
      })
    );

    const merged = baseRows.map((r) => {
      const extra = extrasById.get(String(r.id));

      return {
        ...r,
        created_at: extra?.created_at ?? null,
        quantity_available: extra?.quantity_available ?? 0,
        supplier_country: extra?.supplier?.country ?? null,
        product_image_url: signedUrlByProductId.get(String(r.id)) ?? null,
        gender: extra?.gender ?? null,
        brand_subcategory_id: extra?.brand_subcategory_id ?? null,
        brand_subcategory_en: extra?.catalog_brand_subcategories?.name_en ?? null,
      };
    });

    setRows(merged);
    setBusy(false);
  }

  useEffect(() => {
    runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const brand = labelByLocale({ en: r.brand_en, zh: r.brand_zh }, locale);
      if (safeText(brand)) set.add(safeText(brand));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, locale]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const cat = labelByLocale({ en: r.main_category_en, zh: r.main_category_zh }, locale);
      if (safeText(cat)) set.add(safeText(cat));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, locale]);

  const productTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const type = labelByLocale({ en: r.product_type_en, zh: r.product_type_zh }, locale);
      if (safeText(type)) set.add(safeText(type));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, locale]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (safeText(r.supplier_country)) set.add(safeText(r.supplier_country));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const conditionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (safeText(r.condition)) set.add(safeText(r.condition));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let out = [...rows];

    if (conditionFilter !== "all") {
      out = out.filter((r) => safeText(r.condition) === conditionFilter);
    }

    if (brandFilter !== "all") {
      out = out.filter((r) => {
        const brand = labelByLocale({ en: r.brand_en, zh: r.brand_zh }, locale);
        return safeText(brand) === brandFilter;
      });
    }

    if (categoryFilter !== "all") {
      out = out.filter((r) => {
        const cat = labelByLocale({ en: r.main_category_en, zh: r.main_category_zh }, locale);
        return safeText(cat) === categoryFilter;
      });
    }

    if (productTypeFilter !== "all") {
      out = out.filter((r) => {
        const type = labelByLocale({ en: r.product_type_en, zh: r.product_type_zh }, locale);
        return safeText(type) === productTypeFilter;
      });
    }

    if (genderFilter !== "all") {
      out = out.filter((r) => normalizeGender(r.gender) === genderFilter);
    }

    if (countryFilter !== "all") {
      out = out.filter((r) => safeText(r.supplier_country) === countryFilter);
    }

    out.sort((a, b) => {
      if (sortBy === "newest") {
        const ad = new Date(a.created_at ?? 0).getTime();
        const bd = new Date(b.created_at ?? 0).getTime();
        return bd - ad;
      }

      if (sortBy === "name_asc") {
        return safeText(a.product_name).localeCompare(safeText(b.product_name));
      }

      if (sortBy === "name_desc") {
        return safeText(b.product_name).localeCompare(safeText(a.product_name));
      }

      if (sortBy === "price_asc") {
        return Number(a.final_price ?? Number.MAX_SAFE_INTEGER) - Number(b.final_price ?? Number.MAX_SAFE_INTEGER);
      }

      if (sortBy === "price_desc") {
        return Number(b.final_price ?? -1) - Number(a.final_price ?? -1);
      }

      return 0;
    });

    return out;
  }, [
    rows,
    conditionFilter,
    brandFilter,
    categoryFilter,
    productTypeFilter,
    genderFilter,
    countryFilter,
    sortBy,
    locale,
  ]);

  function clearFilters() {
    setConditionFilter("all");
    setBrandFilter("all");
    setCategoryFilter("all");
    setProductTypeFilter("all");
    setGenderFilter("all");
    setCountryFilter("all");
    setSortBy("newest");
  }

  const isActiveCustomer = !!profile && profile.status === "active" && profile.role === "customer";

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
          <div
            className="row"
            style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}
          >
            <div style={{ maxWidth: 860 }}>
              <h1 className="h1" style={{ marginBottom: 8 }}>
                Luxe Atelier
              </h1>
              <p className="p" style={{ fontSize: 15, lineHeight: 1.7 }}>
                Discover authentic luxury pieces from carefully selected suppliers, cultivated through years of network,
                trust, and expertise.
              </p>
            </div>

            <div className="badge" style={{ background: "rgba(255,255,255,0.88)" }}>
              <span>Results</span>
              <span className="kbd">{filteredRows.length}</span>
            </div>
          </div>

          <div className="spacer" style={{ height: 14 }} />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(q);
            }}
          >
            <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "nowrap" }}>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <input
                  className="input"
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search brand, name, reference code, color, material…"
                  aria-label="Search products"
                  style={{
                    height: 48,
                    borderRadius: 18,
                    padding: "0 20px",
                    fontSize: 15,
                    background: "rgba(255,255,255,0.82)",
                    border: "1px solid rgba(29,27,24,0.08)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
                  }}
                />
              </div>

              <button
                className="btn btnPrimary"
                type="submit"
                style={{
                  height: 48,
                  minWidth: 128,
                  borderRadius: 18,
                  fontSize: 15,
                  fontWeight: 560,
                  boxShadow: "0 10px 24px rgba(31,29,26,0.10)",
                }}
              >
                Search
              </button>
            </div>
          </form>

          <div className="spacer" style={{ height: 14 }} />

          <div
            className="card"
            style={{
              background: "rgba(255,255,255,0.58)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
            }}
          >
            <div className="cardInner" style={{ padding: 16 }}>
              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }}>
                <div style={{ minWidth: 150, flex: "1 1 150px" }}>
                  <div className="p" style={{ marginBottom: 6 }}>Brand</div>
                  <select className="input" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                    <option value="all">All brands</option>
                    {brandOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 150, flex: "1 1 150px" }}>
                  <div className="p" style={{ marginBottom: 6 }}>Category</div>
                  <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                    <option value="all">All categories</option>
                    {categoryOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 150, flex: "1 1 150px" }}>
                  <div className="p" style={{ marginBottom: 6 }}>Product type</div>
                  <select className="input" value={productTypeFilter} onChange={(e) => setProductTypeFilter(e.target.value)}>
                    <option value="all">All product types</option>
                    {productTypeOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 130, flex: "1 1 130px" }}>
                  <div className="p" style={{ marginBottom: 6 }}>Gender</div>
                  <select
                    className="input"
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value as GenderFilter)}
                  >
                    <option value="all">All genders</option>
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                    <option value="unisex">Unisex</option>
                  </select>
                </div>

                <div style={{ minWidth: 130, flex: "1 1 130px" }}>
                  <div className="p" style={{ marginBottom: 6 }}>Condition</div>
                  <select className="input" value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
                    <option value="all">All conditions</option>
                    {conditionOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 155, flex: "1 1 155px" }}>
                  <div className="p" style={{ marginBottom: 6 }}>Supplier country</div>
                  <select className="input" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
                    <option value="all">All supplier countries</option>
                    {countryOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 150, flex: "1 1 150px" }}>
                  <div className="p" style={{ marginBottom: 6 }}>Sort</div>
                  <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
                    <option value="newest">Newest listed</option>
                    <option value="name_asc">Name A–Z</option>
                    <option value="name_desc">Name Z–A</option>
                    <option value="price_asc">Price low to high</option>
                    <option value="price_desc">Price high to low</option>
                  </select>
                </div>

                <button
                  className="btn"
                  type="button"
                  onClick={clearFilters}
                  style={{
                    height: 44,
                    padding: "0 14px",
                    borderRadius: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {busy ? (
        <div className="card">
          <div className="cardInner">
            <p className="p">Loading pieces…</p>
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="badge">
          <span>Error</span>
          <span className="kbd">{err}</span>
        </div>
      ) : null}

      {!busy && filteredRows.length === 0 ? (
        <div className="card">
          <div className="cardInner">
            <p className="p">No results.</p>
          </div>
        </div>
      ) : null}

      <div className="row" style={{ flexDirection: "column", gap: 12 }}>
        {filteredRows.map((r) => {
          const brand = labelByLocale({ en: r.brand_en, zh: r.brand_zh }, locale);
          const type = labelByLocale({ en: r.product_type_en, zh: r.product_type_zh }, locale);
          const subcategory =
            safeText(r.brand_subcategory_en) || (r.brand_subcategory_id != null ? `#${r.brand_subcategory_id}` : "—");

          const avail = Math.max(0, Number(r.quantity_available ?? 0));
          const canReserve = isActiveCustomer && avail > 0;

          return (
            <div
              key={r.id}
              className="card"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.66) 100%)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: "1px solid rgba(29,27,24,0.07)",
                boxShadow: "0 16px 34px rgba(78,64,42,0.08)",
              }}
            >
              <div className="cardInner" style={{ padding: 18 }}>
                <div className="row" style={{ gap: 18, alignItems: "stretch", flexWrap: "nowrap" }}>
                  <div
                    style={{
                      width: 154,
                      minWidth: 154,
                      height: 154,
                      borderRadius: 20,
                      overflow: "hidden",
                      border: "1px solid rgba(29,27,24,0.08)",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.44) 0%, rgba(255,255,255,0.18) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {r.product_image_url ? (
                      <img
                        src={r.product_image_url}
                        alt={r.product_name ?? "Product"}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div className="p">No image</div>
                    )}
                  </div>

                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        gap: 16,
                        alignItems: "flex-start",
                        flexWrap: "nowrap",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                        <Link
                          href={`/product/${r.id}`}
                          style={{
                            display: "inline-block",
                            fontWeight: 650,
                            fontSize: 21,
                            lineHeight: 1.22,
                            letterSpacing: "0.01em",
                            textDecoration: "none",
                          }}
                        >
                          {r.product_name || "Product"}
                        </Link>
                      </div>

                      <div style={{ textAlign: "right", flex: "0 0 auto", minWidth: 170 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 21,
                            letterSpacing: "0.01em",
                          }}
                        >
                          {money(r.currency, r.final_price)}
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
                        <span className="kbd">{subcategory}</span>
                      </div>
                      <div className="badge">
                        <span>Product type</span>
                        <span className="kbd">{safeText(type) || "—"}</span>
                      </div>
                      <div className="badge">
                        <span>Condition</span>
                        <span className="kbd">{safeText(r.condition) || "—"}</span>
                      </div>
                      {safeText(r.reference_code) ? (
                        <div className="badge">
                          <span>Product No.</span>
                          <span className="kbd">{safeText(r.reference_code)}</span>
                        </div>
                      ) : null}
                      <div className="badge">
                        <span>Gender</span>
                        <span className="kbd">{genderLabel(r.gender)}</span>
                      </div>
                      <div className="badge">
                        <span>Supplier country</span>
                        <span className="kbd">{safeText(r.supplier_country) || "—"}</span>
                      </div>
                      <div className="badge">
                        <span>Available</span>
                        <span className="kbd">{avail}</span>
                      </div>
                    </div>

                    <div className="spacer" style={{ height: 14 }} />

                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <Link
                        className="btn btnPrimary"
                        href={`/product/${r.id}`}
                        style={{
                          height: 42,
                          borderRadius: 14,
                          padding: "0 16px",
                          minWidth: 128,
                          boxShadow: "0 10px 24px rgba(31,29,26,0.10)",
                        }}
                      >
                        View product
                      </Link>

                      {canReserve ? (
                        <form
                          action={requestReservation}
                          className="row"
                          style={{
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "nowrap",
                            marginLeft: "auto",
                          }}
                        >
                          <input type="hidden" name="product_id" value={String(r.id)} />

                          <select
                            className="input"
                            name="quantity"
                            defaultValue="1"
                            required
                            style={{
                              width: 78,
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
                            className="btn btnPrimary"
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
                        <div className="badge" style={{ marginLeft: "auto" }}>
                          <span>Reserve</span>
                          <span className="kbd">
                            {!profile
                              ? "Login required"
                              : !isActiveCustomer
                              ? "Customers only"
                              : avail <= 0
                              ? "Out of stock"
                              : "Unavailable"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
