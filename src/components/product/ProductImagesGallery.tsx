"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type ImgRow = { id: string; storage_path: string; created_at: string };

const MAX_IMAGES = 6;

export default function ProductImagesGallery({
  productId,
  canManage = false,
}: {
  productId: string;
  canManage?: boolean;
}) {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<ImgRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const count = rows.length;
  const remaining = useMemo(() => Math.max(0, MAX_IMAGES - count), [count]);

  const currentRow = openIndex !== null ? rows[openIndex] ?? null : null;
  const currentUrl = currentRow ? urls[currentRow.id] ?? null : null;

  async function load() {
    setErr(null);

    const { data, error } = await supabase
      .from("product_images")
      .select("id,storage_path,created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    if (error) {
      setErr(error.message);
      return;
    }

    const items = (data ?? []) as ImgRow[];
    setRows(items);

    const next: Record<string, string> = {};
    for (const r of items) {
      const { data: signed, error: se } = await supabase.storage
        .from("product-images")
        .createSignedUrl(r.storage_path, 60 * 60);

      if (!se && signed?.signedUrl) next[r.id] = signed.signedUrl;
    }
    setUrls(next);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (openIndex === null) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenIndex(null);
      } else if (e.key === "ArrowRight") {
        setOpenIndex((prev) => {
          if (prev === null || rows.length === 0) return prev;
          return (prev + 1) % rows.length;
        });
      } else if (e.key === "ArrowLeft") {
        setOpenIndex((prev) => {
          if (prev === null || rows.length === 0) return prev;
          return (prev - 1 + rows.length) % rows.length;
        });
      }
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex, rows.length]);

  async function removeImage(row: ImgRow) {
    if (!canManage) return;

    setBusy(true);
    setErr(null);

    try {
      const rm = await supabase.storage.from("product-images").remove([row.storage_path]);
      if (rm.error) throw new Error(rm.error.message);

      const del = await supabase
        .from("product_images")
        .delete()
        .eq("id", row.id)
        .eq("product_id", productId);
      if (del.error) throw new Error(del.error.message);

      setOpenIndex((prev) => {
        if (prev === null) return prev;
        const idx = rows.findIndex((x) => x.id === row.id);
        if (idx === -1) return prev;
        if (rows.length <= 1) return null;
        if (prev > idx) return prev - 1;
        if (prev === idx) return 0;
        return prev;
      });

      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function openImage(index: number) {
    setOpenIndex(index);
  }

  function showPrev() {
    setOpenIndex((prev) => {
      if (prev === null || rows.length === 0) return prev;
      return (prev - 1 + rows.length) % rows.length;
    });
  }

  function showNext() {
    setOpenIndex((prev) => {
      if (prev === null || rows.length === 0) return prev;
      return (prev + 1) % rows.length;
    });
  }

  return (
    <div>
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
      >
        <div className="badge">
          <span>Images</span>
          <span className="kbd">{count}/{MAX_IMAGES}</span>
        </div>
      </div>

      {err ? (
        <>
          <div className="spacer" />
          <div className="badge">
            <span>Error</span>
            <span className="kbd">{err}</span>
          </div>
        </>
      ) : null}

      <div className="spacer" />

      {rows.length === 0 ? (
        <p className="p">No images yet.</p>
      ) : (
        <div className="row productGalleryGrid" style={{ flexWrap: "wrap", gap: 12 }}>
          {rows.map((r, idx) => (
            <div
              key={r.id}
              className="productGalleryCard"
              style={{
                width: 180,
                borderRadius: 18,
                border: "1px solid rgba(29,27,24,0.08)",
                background: "rgba(255,255,255,0.55)",
                padding: 12,
              }}
            >
              <button
                type="button"
                onClick={() => openImage(idx)}
                className="productGalleryThumb"
                style={{
                  width: "100%",
                  height: 120,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.35)",
                  border: "1px solid rgba(29,27,24,0.08)",
                  padding: 0,
                  cursor: "zoom-in",
                  display: "block",
                }}
                aria-label={`Open image ${idx + 1}`}
              >
                {urls[r.id] ? (
                  <img
                    src={urls[r.id]}
                    alt="Product"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div className="p" style={{ padding: 12 }}>
                    Loading…
                  </div>
                )}
              </button>

              {canManage ? (
                <>
                  <div className="spacer" style={{ height: 10 }} />
                  <button className="btn" type="button" disabled={busy} onClick={() => removeImage(r)}>
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {openIndex !== null && currentUrl ? (
        <div
          className="productGalleryModal"
          onClick={() => setOpenIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 17, 17, 0.82)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            className="productGalleryModalInner"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "min(1200px, 96vw)",
              height: "min(90vh, 920px)",
              borderRadius: 20,
              overflow: "hidden",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
            }}
          >
            <button
              type="button"
              className="productGalleryClose"
              onClick={() => setOpenIndex(null)}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                height: 40,
                minWidth: 40,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.10)",
                color: "#fff",
                cursor: "pointer",
                padding: "0 12px",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              ✕
            </button>

            {rows.length > 1 ? (
              <>
                <button
                  type="button"
                  className="productGalleryPrev"
                  onClick={showPrev}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: 44,
                    minWidth: 44,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.10)",
                    color: "#fff",
                    cursor: "pointer",
                    padding: "0 14px",
                    fontSize: 22,
                    fontWeight: 600,
                  }}
                  aria-label="Previous image"
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="productGalleryNext"
                  onClick={showNext}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: 44,
                    minWidth: 44,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.10)",
                    color: "#fff",
                    cursor: "pointer",
                    padding: "0 14px",
                    fontSize: 22,
                    fontWeight: 600,
                  }}
                  aria-label="Next image"
                >
                  ›
                </button>
              </>
            ) : null}

            <img
              src={currentUrl}
              alt={`Product image ${openIndex + 1}`}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
                borderRadius: 12,
              }}
            />

            <div
              className="productGalleryCounter"
              style={{
                position: "absolute",
                bottom: 14,
                left: "50%",
                transform: "translateX(-50%)",
                padding: "8px 12px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.42)",
                color: "#fff",
                fontSize: 13,
                lineHeight: 1.2,
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {openIndex + 1} / {rows.length}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}