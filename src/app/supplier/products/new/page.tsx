"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { supplierCreateProduct } from "@/server/actions/createProduct";
import PreUploadImages, { type PreUploadedImage } from "@/components/product/PreUploadImages";
import { SUPPORTED_CURRENCIES } from "@/lib/constants/currency";

type Cat = { id: number; name_en: string | null };
type BrandRow = { brand_id: number; brand_en: string | null; brand_zh: string | null; combos: number };
type SubRow = { brand_subcategory_id: number; brand_subcategory_en: string | null; brand_subcategory_zh: string | null; combos: number };
type TypeRow = { product_type_id: number; product_type_en: string | null; product_type_zh: string | null; combos: number };

type CopySourceRow = {
  id: string;
  supplier_id: string;
  main_category_id: number;
  brand_id: number;
  brand_subcategory_id: number;
  product_type_id: number;
  product_name: string | null;
  gender: string | null;
  reference_code: string | null;
  serial_number: string | null;
  condition: string | null;
  currency: string | null;
  color: string | null;
  material: string | null;
  hardware_details: string | null;
  size_specs: string | null;
  description: string | null;
  quantity_total: number | null;
};

export default function SupplierNewProductPage() {
  const supabase = supabaseBrowser();
  const searchParams = useSearchParams();
  const copyFrom = searchParams.get("copy_from");

  const [err, setErr] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  const [cats, setCats] = useState<Cat[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);

  const [mainCategoryId, setMainCategoryId] = useState<number | "">("");
  const [brandId, setBrandId] = useState<number | "">("");
  const [subcatId, setSubcatId] = useState<number | "">("");
  const [ptypeId, setPtypeId] = useState<number | "">("");

  const [productName, setProductName] = useState("");
  const [gender, setGender] = useState("unisex");
  const [referenceCode, setReferenceCode] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [condition, setCondition] = useState("new");
  const [currency, setCurrency] = useState("USD");
  const [basePrice, setBasePrice] = useState("");
  const [quantityTotal, setQuantityTotal] = useState("1");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [hardwareDetails, setHardwareDetails] = useState("");
  const [sizeSpecs, setSizeSpecs] = useState("");
  const [description, setDescription] = useState("");

  const [preImages, setPreImages] = useState<PreUploadedImage[]>([]);

  useEffect(() => {
    (async () => {
      setErr(null);
      const { data, error } = await supabase
        .from("catalog_main_categories")
        .select("id,name_en")
        .order("name_en", { ascending: true });

      if (error) {
        setErr(error.message);
        return;
      }
      setCats((data ?? []) as Cat[]);
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      if (!mainCategoryId) {
        setBrands([]);
        return;
      }

      setErr(null);

      const { data, error } = await supabase.rpc("catalog_brands_for_category", {
        p_main_category_id: Number(mainCategoryId),
      });

      if (error) {
        setErr(error.message);
        return;
      }

      setBrands((data ?? []) as BrandRow[]);
    })();
  }, [supabase, mainCategoryId]);

  useEffect(() => {
    (async () => {
      if (!mainCategoryId || !brandId) {
        setSubs([]);
        return;
      }

      setErr(null);

      const { data, error } = await supabase.rpc("catalog_subcategories_for_category_brand", {
        p_main_category_id: Number(mainCategoryId),
        p_brand_id: Number(brandId),
      });

      if (error) {
        setErr(error.message);
        return;
      }

      setSubs((data ?? []) as SubRow[]);
    })();
  }, [supabase, mainCategoryId, brandId]);

  useEffect(() => {
    (async () => {
      if (!mainCategoryId || !brandId || !subcatId) {
        setTypes([]);
        return;
      }

      setErr(null);

      const { data, error } = await supabase.rpc("catalog_product_types_for_combo", {
        p_main_category_id: Number(mainCategoryId),
        p_brand_id: Number(brandId),
        p_brand_subcategory_id: Number(subcatId),
      });

      if (error) {
        setErr(error.message);
        return;
      }

      setTypes((data ?? []) as TypeRow[]);
    })();
  }, [supabase, mainCategoryId, brandId, subcatId]);

  useEffect(() => {
    (async () => {
      if (!copyFrom) {
        setCopyNote(null);
        return;
      }

      setErr(null);
      setCopyNote(null);

      const { data: sourceRaw, error: sourceErr } = await supabase
        .from("products")
        .select(
          `
          id,
          supplier_id,
          main_category_id,
          brand_id,
          brand_subcategory_id,
          product_type_id,
          product_name,
          gender,
          reference_code,
          serial_number,
          condition,
          currency,
          color,
          material,
          hardware_details,
          size_specs,
          description,
          quantity_total
        `
        )
        .eq("id", copyFrom)
        .maybeSingle();

      if (sourceErr) {
        setErr(sourceErr.message);
        return;
      }

      const source = sourceRaw as CopySourceRow | null;
      if (!source) {
        setErr("Could not load product to copy.");
        return;
      }

      const { data: pricingRaw, error: pricingErr } = await supabase
        .from("product_supplier_pricing")
        .select("base_price,currency")
        .eq("product_id", copyFrom)
        .maybeSingle();

      if (pricingErr) {
        setErr(pricingErr.message);
        return;
      }

      setMainCategoryId(source.main_category_id ?? "");
      setBrandId(source.brand_id ?? "");
      setSubcatId(source.brand_subcategory_id ?? "");
      setPtypeId(source.product_type_id ?? "");

      setProductName(String(source.product_name ?? ""));
      setGender(String(source.gender ?? "unisex"));
      setReferenceCode(String(source.reference_code ?? ""));
      setSerialNumber(String(source.serial_number ?? ""));
      setCondition(String(source.condition ?? "new"));
      setCurrency(String((pricingRaw as any)?.currency ?? source.currency ?? "USD").toUpperCase());
      setBasePrice(
        (pricingRaw as any)?.base_price === null || (pricingRaw as any)?.base_price === undefined
          ? ""
          : String((pricingRaw as any).base_price)
      );
      setQuantityTotal(String(Math.max(1, Number(source.quantity_total ?? 1))));
      setColor(String(source.color ?? ""));
      setMaterial(String(source.material ?? ""));
      setHardwareDetails(String(source.hardware_details ?? ""));
      setSizeSpecs(String(source.size_specs ?? ""));
      setDescription(String(source.description ?? ""));
      setPreImages([]);
      setCopyNote(`Prefilled from: ${String(source.product_name ?? source.id)}`);
    })();
  }, [supabase, copyFrom]);

  const canList = Number(quantityTotal || 0) > 0;

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
            Create Product
          </h1>
          <p className="p" style={{ fontSize: 15, lineHeight: 1.7 }}>
            Create a new listing with structured catalog selection, polished product details, and a presentation aligned
            with the platform’s standard.
          </p>

          {copyNote ? (
            <>
              <div className="spacer" />
              <div className="badge" style={{ background: "rgba(255,255,255,0.88)" }}>
                <span>Copy Product</span>
                <span className="kbd">{copyNote}</span>
              </div>
            </>
          ) : null}

          {err ? (
            <>
              <div className="spacer" />
              <div className="badge" style={{ background: "rgba(255,255,255,0.88)" }}>
                <span>Error</span>
                <span className="kbd">{err}</span>
              </div>
            </>
          ) : null}
        </div>
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
        <div className="cardInner" style={{ padding: 18 }}>
          <form action={supplierCreateProduct}>
            <input type="hidden" name="pre_uploaded_images_json" value={JSON.stringify(preImages)} />

            <div
              className="card"
              style={{
                marginBottom: 14,
                background: "rgba(255,255,255,0.58)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }}
            >
              <div className="cardInner" style={{ padding: 18 }}>
                <div className="badge">
                  <span>Step 1</span>
                  <span className="kbd">Catalog</span>
                </div>

                <div className="spacer" />

                <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ flex: "1 1 260px", minWidth: 260 }}>
                    <label className="p">Main Category</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <select
                      className="input"
                      name="main_category_id"
                      required
                      value={mainCategoryId}
                      onChange={(e) => {
                        const next = e.target.value ? Number(e.target.value) : "";
                        setMainCategoryId(next);
                        setBrandId("");
                        setSubcatId("");
                        setPtypeId("");
                        setBrands([]);
                        setSubs([]);
                        setTypes([]);
                      }}
                    >
                      <option value="">Select Category…</option>
                      {cats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name_en ?? c.id}
                        </option>
                      ))}
                    </select>
                    <div className="spacer" style={{ height: 6 }} />
                    <div className="badge">
                      <span>Available</span>
                      <span className="kbd">{cats.length}</span>
                    </div>
                  </div>

                  <div style={{ flex: "1 1 260px", minWidth: 260 }}>
                    <label className="p">Brand</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <select
                      className="input"
                      name="brand_id"
                      required
                      disabled={!mainCategoryId}
                      value={brandId}
                      onChange={(e) => {
                        const next = e.target.value ? Number(e.target.value) : "";
                        setBrandId(next);
                        setSubcatId("");
                        setPtypeId("");
                        setSubs([]);
                        setTypes([]);
                      }}
                    >
                      <option value="">{mainCategoryId ? "Select Brand…" : "Pick Category First"}</option>
                      {brands.map((b) => (
                        <option key={b.brand_id} value={b.brand_id}>
                          {b.brand_en ?? b.brand_id}
                        </option>
                      ))}
                    </select>
                    <div className="spacer" style={{ height: 6 }} />
                    <div className="badge">
                      <span>Available</span>
                      <span className="kbd">{brands.length}</span>
                    </div>
                  </div>

                  <div style={{ flex: "1 1 260px", minWidth: 260 }}>
                    <label className="p">Brand Subcategory</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <select
                      className="input"
                      name="brand_subcategory_id"
                      required
                      disabled={!brandId}
                      value={subcatId}
                      onChange={(e) => {
                        const next = e.target.value ? Number(e.target.value) : "";
                        setSubcatId(next);
                        setPtypeId("");
                        setTypes([]);
                      }}
                    >
                      <option value="">{brandId ? "Select Subcategory…" : "Pick Brand First"}</option>
                      {subs.map((s) => (
                        <option key={s.brand_subcategory_id} value={s.brand_subcategory_id}>
                          {s.brand_subcategory_en ?? s.brand_subcategory_id}
                        </option>
                      ))}
                    </select>
                    <div className="spacer" style={{ height: 6 }} />
                    <div className="badge">
                      <span>Available</span>
                      <span className="kbd">{subs.length}</span>
                    </div>
                  </div>

                  <div style={{ flex: "1 1 260px", minWidth: 260 }}>
                    <label className="p">Product Type</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <select
                      className="input"
                      name="product_type_id"
                      required
                      disabled={!subcatId}
                      value={ptypeId}
                      onChange={(e) => setPtypeId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">{subcatId ? "Select Type…" : "Pick Subcategory First"}</option>
                      {types.map((t) => (
                        <option key={t.product_type_id} value={t.product_type_id}>
                          {t.product_type_en ?? t.product_type_id}
                        </option>
                      ))}
                    </select>
                    <div className="spacer" style={{ height: 6 }} />
                    <div className="badge">
                      <span>Available</span>
                      <span className="kbd">{types.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="card"
              style={{
                marginBottom: 14,
                background: "rgba(255,255,255,0.58)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }}
            >
              <div className="cardInner" style={{ padding: 18 }}>
                <div className="badge">
                  <span>Step 2</span>
                  <span className="kbd">Upload Images</span>
                </div>

                <div className="spacer" style={{ height: 8 }} />
                <p className="p">Add multiple product images to give a better view before listing the product.</p>

                <div className="spacer" />
                <PreUploadImages onChange={setPreImages} />
              </div>
            </div>

            <div
              className="card"
              style={{
                background: "rgba(255,255,255,0.58)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }}
            >
              <div className="cardInner" style={{ padding: 18 }}>
                <div className="badge">
                  <span>Step 3</span>
                  <span className="kbd">Details</span>
                </div>

                <div className="spacer" />

                <div className="row">
                  <div style={{ flex: "1 1 420px" }}>
                    <label className="p">Product Name</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <input
                      className="input"
                      name="product_name"
                      required
                      placeholder="e.g., Chanel Classic Flap Bag"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: "0 0 220px" }}>
                    <label className="p">Gender</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <select className="input" name="gender" value={gender} onChange={(e) => setGender(e.target.value)} required>
                      <option value="women">Women</option>
                      <option value="men">Men</option>
                      <option value="unisex">Unisex</option>
                    </select>
                  </div>
                </div>

                <div className="spacer" />

                <div className="row">
                  <div style={{ flex: "1 1 340px" }}>
                    <label className="p">Product No.</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <input
                      className="input"
                      name="reference_code"
                      required
                      value={referenceCode}
                      onChange={(e) => setReferenceCode(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: "1 1 340px" }}>
                    <label className="p">Serial Number (Optional)</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <input
                      className="input"
                      name="serial_number"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="spacer" />

                <div className="row">
                  <div style={{ flex: "0 0 220px" }}>
                    <label className="p">Condition</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <select
                      className="input"
                      name="condition"
                      required
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                    >
                      <option value="new">New</option>
                      <option value="secondhand">Secondhand</option>
                    </select>
                  </div>

                  <div style={{ flex: "0 0 220px" }}>
                    <label className="p">Currency</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <select
                      className="input"
                      name="currency"
                      required
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: "0 0 320px" }}>
                    <label className="p">Selling Price Incl. VAT</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <input
                      className="input"
                      name="base_price"
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                    />
                  </div>
                </div>

                <div className="spacer" />

                <div className="row">
                  <div style={{ flex: "0 0 200px" }}>
                    <label className="p">Quantity</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <input
                      className="input"
                      name="quantity_total"
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={quantityTotal}
                      onChange={(e) => setQuantityTotal(e.target.value)}
                    />
                  </div>
                </div>

                <div className="spacer" />

                <div className="row">
                  <div style={{ flex: "1 1 220px" }}>
                    <label className="p">Color (Optional)</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <input
                      className="input"
                      name="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: "1 1 220px" }}>
                    <label className="p">Material (Optional)</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <input
                      className="input"
                      name="material"
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                    />
                  </div>

                  <div style={{ flex: "1 1 260px" }}>
                    <label className="p">Hardware Details (Optional)</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <input
                      className="input"
                      name="hardware_details"
                      value={hardwareDetails}
                      onChange={(e) => setHardwareDetails(e.target.value)}
                    />
                  </div>
                </div>

                <div className="spacer" />

                <div className="row">
                  <div style={{ flex: "1 1 300px" }}>
                    <label className="p">Size / Specs (Optional)</label>
                    <div className="spacer" style={{ height: 6 }} />
                    <input
                      className="input"
                      name="size_specs"
                      value={sizeSpecs}
                      onChange={(e) => setSizeSpecs(e.target.value)}
                    />
                  </div>
                </div>

                <div className="spacer" />

                <div>
                  <label className="p">Description (Optional)</label>
                  <div className="spacer" style={{ height: 6 }} />
                  <textarea
                    className="input"
                    name="description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="spacer" />

            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="badge">
              </div>

              <div className="row">
                {canList ? (
                  <button className="btn btnPrimary" type="submit" name="status" value="published">
                    List
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}