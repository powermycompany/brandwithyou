"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supplierDeleteProduct } from "@/server/actions/supplierDeleteProduct";

type RelName = { name_en: string | null };
type RelMaybeMany = RelName | RelName[] | null | undefined;

type ProductRow = {
  id: string;
  product_name: string;
  reference_code: string | null;
  status: "draft" | "published";
  created_at: string;
  currency: string;
  quantity_total?: number | null;
  quantity_available?: number | null;
  main_category_id: number;
  brand_id: number;
  brand_subcategory_id: number;
  product_type_id: number;
  catalog_main_categories?: RelName | null;
  catalog_brands?: RelName | null;
  catalog_brand_subcategories?: RelName | null;
  catalog_product_types?: RelName | null;
};

type RawProductRow = Omit<
  ProductRow,
  | "catalog_main_categories"
  | "catalog_brands"
  | "catalog_brand_subcategories"
  | "catalog_product_types"
> & {
  catalog_main_categories?: RelMaybeMany;
  catalog_brands?: RelMaybeMany;
  catalog_brand_subcategories?: RelMaybeMany;
  catalog_product_types?: RelMaybeMany;
};

type PricingRow = {
  product_id: string;
  base_price: number | null;
  currency: string | null;
};

type ImgRow = {
  product_id: string;
  storage_path: string;
  created_at: string;
};

type SortKey =
  | "newest"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc";

type SupplierProductViewRow = ProductRow & {
  image_url?: string | null;
  price_per_unit?: number | null;
  pricing_currency?: string | null;
};

function money(ccy: string | null | undefined, n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `${String(ccy ?? "USD").toUpperCase()} ${v}`;
}

function safeText(v: unknown) {
  return String(v ?? "").trim();
}

function firstRel(v: RelMaybeMany): RelName | null {
  if (Array.isArray(v)) return (v[0] ?? null) as RelName | null;
  return (v ?? null) as RelName | null;
}

export default function SupplierProductsPage() {
  const supabase = supabaseBrowser();

  const [rows, setRows] = useState<SupplierProductViewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusBusyById, setStatusBusyById] = useState<Record<string, boolean>>({});

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  useEffect(() => {
    let alive = true;

    async function load() {
      setBusy(true);
      setErr(null);

      try {
        const { data: me, error: meErr } = await supabase.auth.getUser();
        if (meErr) throw new Error(meErr.message);

        const uid = me.user?.id;
        if (!uid) throw new Error("Not authenticated");

        const { data: productsRaw, error: productsErr } = await supabase
          .from("products")
          .select(
            `
            id,product_name,reference_code,status,
            quantity_total,
            quantity_available,created_at,currency,
            main_category_id,brand_id,brand_subcategory_id,product_type_id,
            catalog_main_categories(name_en),
            catalog_brands(name_en),
            catalog_brand_subcategories(name_en),
            catalog_product_types(name_en)
          `
          )
          .eq("supplier_id", uid)
          .order("created_at", { ascending: false });

        if (productsErr) throw new Error(productsErr.message);

        const rawProducts = ((productsRaw ?? []) as unknown) as RawProductRow[];
        const products: ProductRow[] = rawProducts.map((p) => ({
          ...p,
          catalog_main_categories: firstRel(p.catalog_main_categories),
          catalog_brands: firstRel(p.catalog_brands),
          catalog_brand_subcategories: firstRel(p.catalog_brand_subcategories),
          catalog_product_types: firstRel(p.catalog_product_types),
        }));

        const ids = products.map((p) => p.id);

        const pricingByProduct = new Map<string, PricingRow>();
        if (ids.length > 0) {
          const { data: pricingRaw, error: pricingErr } = await supabase
            .from("product_supplier_pricing")
            .select("product_id,base_price,currency")
            .eq("supplier_id", uid)
            .in("product_id", ids);

          if (pricingErr) throw new Error(pricingErr.message);

          for (const p of (((pricingRaw ?? []) as unknown) as PricingRow[])) {
            pricingByProduct.set(String(p.product_id), p);
          }
        }

        const firstImgByProduct = new Map<string, ImgRow>();
        if (ids.length > 0) {
          const { data: imgsRaw, error: imgsErr } = await supabase
            .from("product_images")
            .select("product_id,storage_path,created_at")
            .in("product_id", ids)
            .order("created_at", { ascending: true });

          if (imgsErr) throw new Error(imgsErr.message);

          for (const im of (((imgsRaw ?? []) as unknown) as ImgRow[])) {
            if (!firstImgByProduct.has(String(im.product_id))) {
              firstImgByProduct.set(String(im.product_id), im);
            }
          }
        }

        const signedUrls = new Map<string, string>();
        await Promise.all(
          Array.from(firstImgByProduct.entries()).map(async ([pid, im]) => {
            const { data: signed, error: sErr } = await supabase.storage
              .from("product-images")
              .createSignedUrl(im.storage_path, 60 * 60);

            if (!sErr && signed?.signedUrl) signedUrls.set(pid, signed.signedUrl);
          })
        );

        const merged: SupplierProductViewRow[] = products.map((p) => {
          const pricing = pricingByProduct.get(p.id);
          return {
            ...p,
            image_url: signedUrls.get(p.id) ?? null,
            price_per_unit:
              pricing?.base_price === null || pricing?.base_price === undefined
                ? null
                : Number(pricing.base_price),
            pricing_currency: pricing?.currency ?? p.currency ?? "USD",
          };
        });

        if (!alive) return;
        setRows(merged);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || e));
        setRows([]);
      } finally {
        if (alive) setBusy(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [supabase]);

  async function handleSetStatus(productId: string, nextStatus: "draft" | "published") {
    setErr(null);
    setStatusBusyById((prev) => ({ ...prev, [productId]: true }));

    const previousRows = rows;

    setRows((prev) =>
      prev.map((row) =>
        row.id === productId
          ? {
              ...row,
              status: nextStatus,
            }
          : row
      )
    );

    try {
      const { error } = await supabase
        .from("products")
        .update({ status: nextStatus })
        .eq("id", productId);

      if (error) throw new Error(error.message);
    } catch (e: any) {
      setRows(previousRows);
      setErr(String(e?.message || e));
    } finally {
      setStatusBusyById((prev) => ({ ...prev, [productId]: false }));
    }
  }

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const brand = safeText(r.catalog_brands?.name_en);
      if (brand) set.add(brand);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const cat = safeText(r.catalog_main_categories?.name_en);
      if (cat) set.add(cat);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const productTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const type = safeText(r.catalog_product_types?.name_en);
      if (type) set.add(type);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let out = [...rows];

    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      out = out.filter((r) => {
        const brand = safeText(r.catalog_brands?.name_en).toLowerCase();
        const cat = safeText(r.catalog_main_categories?.name_en).toLowerCase();
        const sub = safeText(r.catalog_brand_subcategories?.name_en).toLowerCase();
        const type = safeText(r.catalog_product_types?.name_en).toLowerCase();

        return (
          safeText(r.product_name).toLowerCase().includes(qq) ||
          safeText(r.reference_code).toLowerCase().includes(qq) ||
          brand.includes(qq) ||
          cat.includes(qq) ||
          sub.includes(qq) ||
          type.includes(qq)
        );
      });
    }

    if (statusFilter !== "all") {
      out = out.filter((r) => r.status === statusFilter);
    }

    if (brandFilter !== "all") {
      out = out.filter((r) => safeText(r.catalog_brands?.name_en) === brandFilter);
    }

    if (categoryFilter !== "all") {
      out = out.filter((r) => safeText(r.catalog_main_categories?.name_en) === categoryFilter);
    }

    if (productTypeFilter !== "all") {
      out = out.filter((r) => safeText(r.catalog_product_types?.name_en) === productTypeFilter);
    }

    out.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "name_asc") {
        return safeText(a.product_name).localeCompare(safeText(b.product_name));
      }
      if (sortBy === "name_desc") {
        return safeText(b.product_name).localeCompare(safeText(a.product_name));
      }
      if (sortBy === "price_asc") {
        return Number(a.price_per_unit ?? Number.MAX_SAFE_INTEGER) - Number(b.price_per_unit ?? Number.MAX_SAFE_INTEGER);
      }
      if (sortBy === "price_desc") {
        return Number(b.price_per_unit ?? -1) - Number(a.price_per_unit ?? -1);
      }
      return 0;
    });

    return out;
  }, [rows, q, statusFilter, brandFilter, categoryFilter, productTypeFilter, sortBy]);

  function clearFilters() {
    setQ("");
    setStatusFilter("all");
    setBrandFilter("all");
    setCategoryFilter("all");
    setProductTypeFilter("all");
    setSortBy("newest");
  }

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
                Products
              </h1>
              <p className="p" style={{ fontSize: 15, lineHeight: 1.7 }}>
                Manage your portfolio with a refined overview of listings, pricing, availability, and product visibility,
                giving you clear control over how your collection is presented on the platform.
              </p>
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <div className="badge" style={{ background: "rgba(255,255,255,0.88)" }}>
                <span>Results</span>
                <span className="kbd">{filteredRows.length}</span>
              </div>
              <Link className="btn btnPrimary" href="/supplier/products/new">
                New product
              </Link>
            </div>
          </div>

          <div className="spacer" style={{ height: 14 }} />

          <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "nowrap" }}>
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, reference, brand, category..."
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
          </div>

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
                  <div className="p" style={{ marginBottom: 6 }}>Status</div>
                  <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="published">listed</option>
                    <option value="draft">delisted</option>
                  </select>
                </div>

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
            <p className="p">Loading products…</p>
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
            <p className="p">No products found.</p>
          </div>
        </div>
      ) : null}

      <div className="row" style={{ flexDirection: "column", gap: 12 }}>
        {filteredRows.map((p) => {
          const img = p.image_url;
          const sell = p.price_per_unit ?? null;
          const ccy = (p.pricing_currency ?? p.currency ?? "USD").toUpperCase();

          const brand = p.catalog_brands?.name_en ?? `#${p.brand_id}`;
          const cat = p.catalog_main_categories?.name_en ?? `#${p.main_category_id}`;
          const sub = p.catalog_brand_subcategories?.name_en ?? `#${p.brand_subcategory_id}`;
          const type = p.catalog_product_types?.name_en ?? `#${p.product_type_id}`;

          const qtyAvailable = Math.max(0, Number(p.quantity_available ?? 0));
          const qtyTotal = Math.max(0, Number(p.quantity_total ?? 0));
          const canManageActions = qtyAvailable > 0;
          const isStatusBusy = !!statusBusyById[p.id];

          return (
            <div
              key={p.id}
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
                      flex: "0 0 auto",
                    }}
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={p.product_name ?? "Product"}
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
                          href={`/supplier/products/${p.id}`}
                          style={{
                            display: "inline-block",
                            fontWeight: 650,
                            fontSize: 21,
                            lineHeight: 1.22,
                            letterSpacing: "0.01em",
                            textDecoration: "none",
                          }}
                        >
                          {p.product_name}
                        </Link>
                      </div>
                    </div>

                    <div className="spacer" style={{ height: 14 }} />

                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div className="badge">
                        <span>Status</span>
                        <span className="kbd">{p.status === "published" ? "listed" : "delisted"}</span>
                      </div>

                      {safeText(p.reference_code) ? (
                        <div className="badge">
                          <span>Reference</span>
                          <span className="kbd">{p.reference_code}</span>
                        </div>
                      ) : null}

                      <div className="badge">
                        <span>Brand</span>
                        <span className="kbd">{brand}</span>
                      </div>

                      <div className="badge">
                        <span>Category</span>
                        <span className="kbd">{cat}</span>
                      </div>

                      <div className="badge">
                        <span>Subcategory</span>
                        <span className="kbd">{sub}</span>
                      </div>

                      <div className="badge">
                        <span>Product type</span>
                        <span className="kbd">{type}</span>
                      </div>

                      <div className="badge">
                        <span>Price per unit</span>
                        <span className="kbd">{money(ccy, sell)}</span>
                      </div>

                      <div className="badge">
                        <span>Quantity</span>
                        <span className="kbd">{qtyAvailable}/{qtyTotal}</span>
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
                      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <Link
                          className="btn btnPrimary"
                          href={`/supplier/products/${p.id}`}
                          style={{
                            height: 42,
                            borderRadius: 14,
                            padding: "0 16px",
                            minWidth: 128,
                            boxShadow: "0 10px 24px rgba(31,29,26,0.10)",
                          }}
                        >
                          Edit product
                        </Link>

                        <Link
                          className="btn"
                          href={`/supplier/products/new?copy_from=${encodeURIComponent(p.id)}`}
                          style={{
                            height: 42,
                            borderRadius: 14,
                            padding: "0 16px",
                            minWidth: 124,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textDecoration: "none",
                          }}
                        >
                          Copy product
                        </Link>

                        {canManageActions ? (
                          <>
                            {p.status === "published" ? (
                              <button
                                className="btn"
                                type="button"
                                disabled={isStatusBusy}
                                onClick={() => handleSetStatus(p.id, "draft")}
                                style={{ height: 42, borderRadius: 14, padding: "0 16px" }}
                              >
                                {isStatusBusy ? "Working..." : "Delist"}
                              </button>
                            ) : (
                              <button
                                className="btn btnPrimary"
                                type="button"
                                disabled={isStatusBusy}
                                onClick={() => handleSetStatus(p.id, "published")}
                                style={{
                                  height: 42,
                                  borderRadius: 14,
                                  padding: "0 16px",
                                  minWidth: 100,
                                  boxShadow: "0 10px 24px rgba(31,29,26,0.10)",
                                }}
                              >
                                {isStatusBusy ? "Working..." : "List"}
                              </button>
                            )}

                            <form action={supplierDeleteProduct}>
                              <input type="hidden" name="product_id" value={p.id} />
                              <button
                                className="btn"
                                type="submit"
                                style={{ height: 42, borderRadius: 14, padding: "0 16px" }}
                              >
                                Delete
                              </button>
                            </form>
                          </>
                        ) : null}
                      </div>
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