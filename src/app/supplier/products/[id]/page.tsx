import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import ProductImagesGallery from "@/components/product/ProductImagesGallery";
import ProductImagesUploader from "@/components/product/ProductImagesUploader";
import ConfidentialFilesGallery from "@/components/product/ConfidentialFilesGallery";
import ConfidentialFilesUploader from "@/components/product/ConfidentialFilesUploader";
import { supplierSetProductStatus, supplierUpdateProduct } from "@/server/actions/supplierUpdateProduct";
import { supplierDeleteProduct } from "@/server/actions/supplierDeleteProduct";

type ProductRow = {
  id: string;
  supplier_id: string;
  product_name: string;
  reference_code: string;
  serial_number: string | null;
  status: "draft" | "published";
  currency: string;
  color: string | null;
  material: string | null;
  hardware_details: string | null;
  size_specs: string | null;
  description: string | null;
  quantity_total?: number | null;
  quantity_available?: number | null;

  main_category_id: number;
  brand_id: number;
  brand_subcategory_id: number;
  product_type_id: number;

  catalog_main_categories?: { name_en: string | null } | null;
  catalog_brands?: { name_en: string | null } | null;
  catalog_brand_subcategories?: { name_en: string | null } | null;
  catalog_product_types?: { name_en: string | null } | null;
};

function hasText(v: unknown) {
  return String(v ?? "").trim().length > 0;
}

export default async function SupplierProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: me } = await supabase.auth.getUser();
  const uid = me.user?.id;

  const { data: productRaw } = await supabase
    .from("products")
    .select(
      `
      id,supplier_id,product_name,reference_code,serial_number,status,currency,color,material,
      hardware_details,size_specs,description,
      quantity_total,
      quantity_available,
      main_category_id,brand_id,brand_subcategory_id,product_type_id,
      catalog_main_categories(name_en),
      catalog_brands(name_en),
      catalog_brand_subcategories(name_en),
      catalog_product_types(name_en)
    `
    )
    .eq("id", id)
    .maybeSingle();

  const product = productRaw as ProductRow | null;

  const { data: pricing } = await supabase
    .from("product_supplier_pricing")
    .select("base_price,currency")
    .eq("product_id", id)
    .eq("supplier_id", uid)
    .maybeSingle();

  if (!product || product.supplier_id !== uid) {
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

  const cat = product.catalog_main_categories?.name_en ?? `#${product.main_category_id}`;
  const brand = product.catalog_brands?.name_en ?? `#${product.brand_id}`;
  const sub = product.catalog_brand_subcategories?.name_en ?? `#${product.brand_subcategory_id}`;
  const type = product.catalog_product_types?.name_en ?? `#${product.product_type_id}`;

  const qtyAvailable = Math.max(0, Number(product.quantity_available ?? 0));
  const qtyTotal = Math.max(0, Number(product.quantity_total ?? 0));
  const canManageActions = qtyAvailable > 0;
  const isLocked = qtyAvailable <= 0;

  const priceCurrency = String((pricing as any)?.currency ?? product.currency ?? "USD").toUpperCase();
  const sellPrice =
    (pricing as any)?.base_price === null || (pricing as any)?.base_price === undefined
      ? "—"
      : `${priceCurrency} ${Math.round(Number((pricing as any).base_price) * 100) / 100}`;

  return (
    <div className="row" style={{ flexDirection: "column", gap: 16 }}>
      <div className="row supplierProductBackRow" style={{ justifyContent: "flex-end" }}>
        <Link
          href="/supplier/products"
          className="btn supplierProductBackButton"
          style={{
            height: 42,
            borderRadius: 14,
            padding: "0 16px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          ← Back to Products
        </Link>
      </div>

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
            className="row supplierProductHeroRow"
            style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
          >
            <div>
              <h1 className="h1" style={{ marginBottom: 8 }}>
                Edit Product
              </h1>
              <p className="p" style={{ fontSize: 15, lineHeight: 1.7 }}>
                Refine your product details, manage listing status, and keep both imagery and documentation organized in one place.
              </p>
            </div>

            {canManageActions ? (
              <div className="row supplierProductHeroActions" style={{ alignItems: "center", gap: 10 }}>
                <form action={supplierSetProductStatus} className="row supplierProductHeroForm">
                  <input type="hidden" name="product_id" value={product.id} />
                  {product.status === "published" ? (
                    <button className="btn supplierProductHeroButton" type="submit" name="status" value="draft">
                      Delist
                    </button>
                  ) : (
                    <button className="btn btnPrimary supplierProductHeroButton" type="submit" name="status" value="published">
                      List
                    </button>
                  )}
                </form>

                <form action={supplierDeleteProduct} className="row supplierProductHeroForm">
                  <input type="hidden" name="product_id" value={product.id} />
                  <button className="btn supplierProductHeroButton" type="submit">
                    Delete
                  </button>
                </form>
              </div>
            ) : null}
          </div>

          <div className="spacer" />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="badge">
              <span>Status</span>
              <span className="kbd">{product.status === "published" ? "listed" : "delisted"}</span>
            </div>
            <div className="badge">
              <span>Quantity</span>
              <span className="kbd">{qtyAvailable}/{qtyTotal}</span>
            </div>
            <div className="badge">
              <span>Main Category</span>
              <span className="kbd">{cat}</span>
            </div>
            <div className="badge">
              <span>Brand</span>
              <span className="kbd">{brand}</span>
            </div>
            <div className="badge">
              <span>Brand Subcategory</span>
              <span className="kbd">{sub}</span>
            </div>
            <div className="badge">
              <span>Product Type</span>
              <span className="kbd">{type}</span>
            </div>
            <div className="badge">
              <span>Price Per Unit</span>
              <span className="kbd">{sellPrice}</span>
            </div>

            {hasText(product.color) ? (
              <div className="badge">
                <span>Color</span>
                <span className="kbd">{product.color}</span>
              </div>
            ) : null}

            {hasText(product.material) ? (
              <div className="badge">
                <span>Material</span>
                <span className="kbd">{product.material}</span>
              </div>
            ) : null}

            {hasText(product.hardware_details) ? (
              <div className="badge">
                <span>Hardware Details</span>
                <span className="kbd">{product.hardware_details}</span>
              </div>
            ) : null}

            {hasText(product.size_specs) ? (
              <div className="badge">
                <span>Size / Specs</span>
                <span className="kbd">{product.size_specs}</span>
              </div>
            ) : null}

            {isLocked ? (
              <div className="badge">
                <span>Editing</span>
                <span className="kbd">Locked when available is 0</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.66) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(29,27,24,0.07)",
          opacity: isLocked ? 0.72 : 1,
        }}
      >
        <div className="cardInner" style={{ padding: 18 }}>
          <form action={supplierUpdateProduct}>
            <input type="hidden" name="product_id" value={product.id} />

            <div className="badge">
              <span>Editable Details</span>
              <span className="kbd">{isLocked ? "Locked" : "Update"}</span>
            </div>

            <div className="spacer" />

            <div className="row supplierProductEditRow">
              <div className="supplierProductEditField" style={{ flex: "1 1 420px" }}>
                <label className="p">Product Name</label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  className="input"
                  name="product_name"
                  required
                  defaultValue={product.product_name}
                  disabled={isLocked}
                />
              </div>
              <div className="supplierProductEditField" style={{ flex: "1 1 320px" }}>
                <label className="p">Product No.</label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  className="input"
                  name="reference_code"
                  required
                  defaultValue={product.reference_code}
                  disabled={isLocked}
                />
              </div>
              <div className="supplierProductEditField" style={{ flex: "1 1 320px" }}>
                <label className="p">Serial Number (Optional)</label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  className="input"
                  name="serial_number"
                  defaultValue={product.serial_number ?? ""}
                  disabled={isLocked}
                />
              </div>
            </div>

            <div className="spacer" />

            <div className="row supplierProductEditRow">
              <div className="supplierProductEditField" style={{ flex: "1 1 220px" }}>
                <label className="p">Color (Optional)</label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  className="input"
                  name="color"
                  defaultValue={product.color ?? ""}
                  disabled={isLocked}
                />
              </div>
              <div className="supplierProductEditField" style={{ flex: "1 1 220px" }}>
                <label className="p">Material (Optional)</label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  className="input"
                  name="material"
                  defaultValue={product.material ?? ""}
                  disabled={isLocked}
                />
              </div>
              <div className="supplierProductEditField" style={{ flex: "1 1 260px" }}>
                <label className="p">Hardware Details (Optional)</label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  className="input"
                  name="hardware_details"
                  defaultValue={product.hardware_details ?? ""}
                  disabled={isLocked}
                />
              </div>
            </div>

            <div className="spacer" />

            <div className="row supplierProductEditRow">
              <div className="supplierProductEditField" style={{ flex: "1 1 300px" }}>
                <label className="p">Size / Specs (Optional)</label>
                <div className="spacer" style={{ height: 6 }} />
                <input
                  className="input"
                  name="size_specs"
                  defaultValue={product.size_specs ?? ""}
                  disabled={isLocked}
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
                rows={5}
                defaultValue={product.description ?? ""}
                disabled={isLocked}
                style={{
                  minHeight: 120,
                  resize: "vertical",
                  lineHeight: 1.6,
                  paddingTop: 14,
                  paddingBottom: 14,
                }}
              />
            </div>

            {!isLocked ? (
              <div style={{ marginTop: 18 }}>
                <button className="btn btnPrimary supplierProductSaveButton" type="submit">
                  Save Changes
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </div>

      <div
        className="card"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(255,255,255,0.66) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(29,27,24,0.07)",
          opacity: isLocked ? 0.72 : 1,
        }}
      >
        <div className="cardInner" style={{ padding: 18 }}>
          <div className="badge">
            <span>Product Images</span>
            <span className="kbd">{isLocked ? "Locked" : "Manage"}</span>
          </div>

          <div className="spacer" style={{ height: 8 }} />
          <p className="p">Upload, review, and manage the product imagery shown on the platform.</p>

          <div className="spacer" />
          <ProductImagesGallery productId={product.id} canManage={!isLocked} />
          {!isLocked ? (
            <>
              <div className="spacer" />
              <ProductImagesUploader productId={product.id} />
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
          <div className="badge">
            <span>Confidential Files</span>
            <span className="kbd">Supplier/Admin only</span>
          </div>

          <div className="spacer" style={{ height: 8 }} />
          <p className="p">
            Upload receipts, invoices, authenticity cards, purchase records, or internal documents. These files remain private and are not visible to customers.
          </p>

          <div className="spacer" />
          <ConfidentialFilesGallery productId={product.id} canManage />
          <div className="spacer" />
          <ConfidentialFilesUploader productId={product.id} />
        </div>
      </div>
    </div>
  );
}