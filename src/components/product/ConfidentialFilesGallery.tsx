"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Row = {
  id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  created_at: string;
};

export default function ConfidentialFilesGallery({
  productId,
  canManage = false,
}: {
  productId: string;
  canManage?: boolean;
}) {
  const supabase = supabaseBrowser();

  const [rows, setRows] = useState<Row[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);

    const { data, error } = await supabase
      .from("product_confidential_files")
      .select("id,storage_path,file_name,mime_type,created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });

    if (error) {
      setErr(error.message);
      return;
    }

    const items = (data ?? []) as Row[];
    setRows(items);

    const next: Record<string, string> = {};
    for (const r of items) {
      const { data: signed, error: se } = await supabase.storage
        .from("product-confidential")
        .createSignedUrl(r.storage_path, 60 * 60);

      if (!se && signed?.signedUrl) next[r.id] = signed.signedUrl;
    }
    setUrls(next);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function removeFile(row: Row) {
    if (!canManage) return;

    setBusy(true);
    setErr(null);

    try {
      const rm = await supabase.storage.from("product-confidential").remove([row.storage_path]);
      if (rm.error) throw new Error(rm.error.message);

      const del = await supabase
        .from("product_confidential_files")
        .delete()
        .eq("id", row.id)
        .eq("product_id", productId);

      if (del.error) throw new Error(del.error.message);

      await load();
    } catch (x: any) {
      setErr(String(x?.message || x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {err ? (
        <>
          <div className="badge">
            <span>Error</span>
            <span className="kbd">{err}</span>
          </div>
          <div className="spacer" />
        </>
      ) : null}

      {rows.length === 0 ? (
        <p className="p">No confidential files yet.</p>
      ) : (
        <div className="row" style={{ flexDirection: "column", gap: 10 }}>
          {rows.map((r) => {
            const url = urls[r.id];

            return (
              <div
                key={r.id}
                style={{
                  borderRadius: 20,
                  border: "1px solid rgba(29,27,24,0.08)",
                  background: "rgba(255,255,255,0.55)",
                  padding: 14,
                }}
              >
                <div className="row" style={{ gap: 14, alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-block",
                          fontWeight: 600,
                          fontSize: 15,
                          lineHeight: 1.35,
                          color: "inherit",
                          textDecoration: "none",
                          wordBreak: "break-word",
                        }}
                      >
                        {r.file_name ?? "Untitled file"}
                      </a>
                    ) : (
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          lineHeight: 1.35,
                          wordBreak: "break-word",
                        }}
                      >
                        {r.file_name ?? "Untitled file"}
                      </div>
                    )}
                  </div>

                  {canManage ? (
                    <button
                      className="btn"
                      type="button"
                      disabled={busy}
                      onClick={() => removeFile(r)}
                      style={{
                        height: 40,
                        minWidth: 96,
                        padding: "0 14px",
                        borderRadius: 14,
                        flex: "0 0 auto",
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}