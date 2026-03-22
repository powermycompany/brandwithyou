import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type ThreadRow = {
  id: string;
  reservation_id: string;
  product_id: string;
  customer_id: string;
  updated_at: string;

  product:
    | {
        product_name: string | null;
        reference_code: string | null;
        currency: string | null;
        brand_id: number | null;
        brand_subcategory_id: number | null;
        product_type_id: number | null;
        gender: string | null;
        condition: string | null;
        catalog_brands?: { name_en: string | null } | null;
        catalog_brand_subcategories?: { name_en: string | null } | null;
        catalog_product_types?: { name_en: string | null } | null;
      }
    | null;

  customer:
    | {
        account_name: string | null;
        email: string | null;
        country: string | null;
      }
    | null;

  reservation:
    | {
        status: string | null;
        quantity: number | null;
      }
    | null;
};

type ThreadReadRow = {
  thread_id: string;
  user_id: string;
  last_read_at: string | null;
};

function d(s: string) {
  return new Date(s).toLocaleDateString();
}

function money(ccy: string | null | undefined, n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Math.round(Number(n) * 100) / 100;
  return `${String(ccy ?? "USD").toUpperCase()} ${v}`;
}

function genderLabel(v: unknown) {
  const x = String(v ?? "").trim().toLowerCase();
  if (x === "men" || x === "male" || x === "man") return "Men";
  if (x === "women" || x === "female" || x === "woman") return "Women";
  if (x === "unisex") return "Unisex";
  return "—";
}

export default async function SupplierMessagesPage() {
  const supabase = await supabaseServer();

  const { data: me, error: meErr } = await supabase.auth.getUser();
  if (meErr) throw new Error(meErr.message);
  const uid = me.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data: rowsRaw, error } = await supabase
    .from("chat_threads")
    .select(
      `
      id,reservation_id,product_id,customer_id,updated_at,
      product:products!chat_threads_product_id_fkey(
        product_name,
        reference_code,
        currency,
        brand_id,
        brand_subcategory_id,
        product_type_id,
        gender,
        condition,
        catalog_brands(name_en),
        catalog_brand_subcategories(name_en),
        catalog_product_types(name_en)
      ),
      customer:profiles!chat_threads_customer_id_fkey(
        account_name,
        email,
        country
      ),
      reservation:reservations!chat_threads_reservation_id_fkey(
        status,
        quantity
      )
    `.trim()
    )
    .eq("supplier_id", uid)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = ((rowsRaw ?? []) as unknown) as ThreadRow[];
  const threadIds = rows.map((t) => t.id).filter(Boolean);

  const readByThreadId = new Map<string, string | null>();

  if (threadIds.length > 0) {
    const { data: readsRaw, error: readsErr } = await supabase
      .from("chat_thread_reads")
      .select("thread_id,user_id,last_read_at")
      .eq("user_id", uid)
      .in("thread_id", threadIds);

    if (readsErr) throw new Error(readsErr.message);

    for (const r of (((readsRaw ?? []) as unknown) as ThreadReadRow[])) {
      readByThreadId.set(String(r.thread_id), r.last_read_at ?? null);
    }
  }

  const pricingByProductId = new Map<string, { currency: string; final_price: number | null }>();

  for (const t of rows) {
    const pid = String(t.product_id);
    if (!pid || pricingByProductId.has(pid)) continue;

    const { data: p } = await supabase
      .rpc("get_market_product_pricing", { p_product_id: pid })
      .maybeSingle();

    pricingByProductId.set(pid, {
      currency: String((p as any)?.currency ?? t.product?.currency ?? "USD").toUpperCase(),
      final_price:
        (p as any)?.final_price === null || (p as any)?.final_price === undefined
          ? null
          : Number((p as any).final_price),
    });
  }

  const newMessageCount = rows.filter((t) => {
    const lastReadAt = readByThreadId.get(String(t.id));
    if (!lastReadAt) return true;
    return new Date(t.updated_at).getTime() > new Date(lastReadAt).getTime();
  }).length;

  return (
    <div className="row" style={{ flexDirection: "column", gap: 14 }}>
      <div className="card">
        <div className="cardInner">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <h1 className="h1">Messages</h1>
              <p className="p">
                Threads open automatically when you confirm a reservation, giving you a clear overview of the related
                product, customer, quantity, and reservation status before opening the conversation.
              </p>
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <Link className="btn" href="/supplier/reservations">
                Reservations
              </Link>
              <div className="badge">
                <span>Unread threads</span>
                <span className="kbd">{newMessageCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <div className="cardInner">
            <p className="p">No message threads yet. Confirm a reservation to open a chat.</p>
          </div>
        </div>
      ) : (
        <div className="row" style={{ flexDirection: "column", gap: 10 }}>
          {rows.map((t) => {
            const brand =
              t.product?.catalog_brands?.name_en ??
              (t.product?.brand_id != null ? `#${t.product.brand_id}` : "—");

            const subcategory =
              t.product?.catalog_brand_subcategories?.name_en ??
              (t.product?.brand_subcategory_id != null ? `#${t.product.brand_subcategory_id}` : "—");

            const productType =
              t.product?.catalog_product_types?.name_en ??
              (t.product?.product_type_id != null ? `#${t.product.product_type_id}` : "—");

            const qty = Number(t.reservation?.quantity ?? 1);

            const pricing = pricingByProductId.get(String(t.product_id));
            const ccy = pricing?.currency ?? String(t.product?.currency ?? "USD").toUpperCase();
            const unitPrice = pricing?.final_price ?? null;
            const totalPrice = unitPrice === null ? null : unitPrice * qty;

            const lastReadAt = readByThreadId.get(String(t.id));
            const isNewMessage =
              !lastReadAt || new Date(t.updated_at).getTime() > new Date(lastReadAt).getTime();

            return (
              <div
                key={t.id}
                className="card"
                style={
                  isNewMessage
                    ? {
                        border: "1px solid rgba(198,40,40,0.22)",
                        boxShadow: "0 12px 28px rgba(198,40,40,0.08)",
                      }
                    : undefined
                }
              >
                <div className="cardInner">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 260, flex: "1 1 auto" }}>
                      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 650 }}>
                          {t.product?.product_name ?? "Product"}
                        </div>

                        {isNewMessage ? (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: "rgba(198,40,40,0.10)",
                              border: "1px solid rgba(198,40,40,0.16)",
                              color: "#8e1f1f",
                              fontWeight: 650,
                              fontSize: 13,
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "999px",
                                background: "#c62828",
                                display: "inline-block",
                              }}
                            />
                            New message
                          </div>
                        ) : null}
                      </div>

                      <div className="p">
                        Customer: {t.customer?.account_name ?? t.customer_id}
                        {t.customer?.email ? ` · ${t.customer.email}` : ""}
                      </div>

                      <div className="spacer" style={{ height: 8 }} />

                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <div className="badge">
                          <span>Brand</span>
                          <span className="kbd">{brand}</span>
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
                          <span className="kbd">{genderLabel(t.product?.gender)}</span>
                        </div>
                        {t.product?.reference_code ? (
                          <div className="badge">
                            <span>Reference</span>
                            <span className="kbd">{t.product.reference_code}</span>
                          </div>
                        ) : null}
                        <div className="badge">
                          <span>Condition</span>
                          <span className="kbd">{t.product?.condition ?? "—"}</span>
                        </div>
                        <div className="badge">
                          <span>Customer country</span>
                          <span className="kbd">{t.customer?.country ?? "—"}</span>
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
                        <span>Qty</span>
                        <span className="kbd">{qty}</span>
                      </div>
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
                        <span className="kbd">{t.reservation?.status ?? "—"}</span>
                      </div>
                      <div className="badge">
                        <span>Updated</span>
                        <span className="kbd">{d(t.updated_at)}</span>
                      </div>
                      <Link className="btn btnPrimary" href={`/supplier/messages/${t.id}`}>
                        Open messages
                      </Link>
                      <Link className="btn" href={`/product/${t.product_id}`}>
                        View product
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}