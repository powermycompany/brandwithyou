"use client";

import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

function sanitizeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ConfidentialFilesUploader({
  productId,
  onUploaded,
}: {
  productId: string;
  onUploaded?: () => void;
}) {
  const supabase = supabaseBrowser();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);

  async function onPick(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    setBusy(true);
    setErr(null);

    try {
      const { data: me, error: meErr } = await supabase.auth.getUser();
      if (meErr) throw new Error(meErr.message);

      const uid = me.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const next = [...files];

      for (const file of Array.from(fileList)) {
        const safeName = sanitizeFileName(file.name || "file");
        const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;

        const up = await supabase.storage.from("product-confidential").upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

        if (up.error) throw new Error(up.error.message);

        const ins = await supabase.from("product_confidential_files").insert({
          product_id: productId,
          supplier_id: uid,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
        });

        if (ins.error) throw new Error(ins.error.message);

        next.push(file.name || path);
      }

      setFiles(next);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded?.();
    } catch (x: any) {
      setErr(String(x?.message || x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label
        className="btn"
        style={{
          height: 46,
          padding: "0 18px",
          borderRadius: 14,
          cursor: busy ? "not-allowed" : "pointer",
          background: "rgba(255,255,255,0.08)",
          color: "var(--text)",
          border: "1px solid var(--line)",
          boxShadow: "none",
          fontWeight: 600,
          width: "fit-content",
        }}
      >
        {busy ? "Uploading..." : "Upload Files"}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          disabled={busy}
          style={{ display: "none" }}
          onChange={(e) => onPick(e.target.files)}
        />
      </label>

      <div className="spacer" />

      {err ? (
        <>
          <div className="spacer" />
          <div className="badge">
            <span>Error</span>
            <span className="kbd">{err}</span>
          </div>
        </>
      ) : null}

      {files.length > 0 ? (
        <>
          <div className="spacer" />
          <div className="row" style={{ flexDirection: "column", gap: 10 }}>
            {files.map((name, idx) => (
              <div
                key={`${name}-${idx}`}
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <div className="badge" style={{ maxWidth: "75%" }}>
                  <span>File</span>
                  <span className="kbd" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}