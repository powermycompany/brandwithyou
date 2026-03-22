"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const MAX_IMAGES = 6;
const MAX_MB = 5;

export default function ProductImagesUploader({ productId }: { productId: string }) {
  const supabase = supabaseBrowser();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  async function refreshCount() {
    const { count, error } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    if (!error) setCount(count ?? 0);
  }

  useEffect(() => {
    refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;

    setBusy(true);
    setErr(null);
    setOk(null);

    try {
      const { data: au } = await supabase.auth.getUser();
      const uid = au.user?.id;
      if (!uid) throw new Error("not logged in");

      const { count: currentCount } = await supabase
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId);

      const safeCount = currentCount ?? 0;
      setCount(safeCount);

      const remaining = Math.max(0, MAX_IMAGES - safeCount);
      if (remaining <= 0) throw new Error("max 6 images reached");

      const toUpload = Math.min(files.length, remaining);

      for (let i = 0; i < toUpload; i++) {
        const f = files[i];
        const mb = f.size / (1024 * 1024);

        if (mb > MAX_MB) {
          throw new Error(`image too large (${mb.toFixed(1)} MB). max ${MAX_MB} MB`);
        }

        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const key = `${uid}/${productId}/${crypto.randomUUID()}.${ext}`;

        const up = await supabase.storage.from("product-images").upload(key, f, {
          cacheControl: "3600",
          upsert: false,
        });

        if (up.error) throw new Error(up.error.message);

        const ins = await supabase.from("product_images").insert({
          product_id: productId,
          storage_path: key,
        });

        if (ins.error) throw new Error(ins.error.message);
      }

      setOk("Uploaded");
      if (fileRef.current) fileRef.current.value = "";
      await refreshCount();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="badge">
          <span>Upload</span>
          <span className="kbd">{count}/{MAX_IMAGES}</span>
        </div>
        <div className="badge">
          <span>Max</span>
          <span className="kbd">{MAX_MB}MB / image</span>
        </div>
      </div>

      <div className="spacer" />

      <label
        className="btn"
        style={{
          height: 46,
          padding: "0 18px",
          borderRadius: 14,
          cursor: busy || count >= MAX_IMAGES ? "not-allowed" : "pointer",
          background: "rgba(255,255,255,0.08)",
          color: "var(--text)",
          border: "1px solid var(--line)",
          boxShadow: "none",
          fontWeight: 600,
          width: "fit-content",
          opacity: busy || count >= MAX_IMAGES ? 0.6 : 1,
        }}
      >
        {busy ? "Uploading..." : count >= MAX_IMAGES ? "Max Images Reached" : "Upload Images"}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          disabled={busy || count >= MAX_IMAGES}
          style={{ display: "none" }}
          onChange={(e) => onPick(e.target.files)}
        />
      </label>

      <div className="spacer" />

      {busy ? <p className="p">Uploading…</p> : null}

      {ok ? (
        <div className="badge">
          <span>Status</span>
          <span className="kbd">{ok}</span>
        </div>
      ) : null}

      {err ? (
        <div className="badge">
          <span>Error</span>
          <span className="kbd">{err}</span>
        </div>
      ) : null}
    </div>
  );
}