"use client";

import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export type PreUploadedImage = {
  path: string;
  fileName: string;
};

type PreviewImage = PreUploadedImage & {
  previewUrl: string;
};

export default function PreUploadImages({
  onChange,
}: {
  onChange: (images: PreUploadedImage[]) => void;
}) {
  const supabase = supabaseBrowser();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      for (const im of images) {
        URL.revokeObjectURL(im.previewUrl);
      }
    };
  }, [images]);

  useEffect(() => {
    if (openIndex === null) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenIndex(null);
      } else if (e.key === "ArrowRight") {
        setOpenIndex((prev) => {
          if (prev === null || images.length === 0) return prev;
          return (prev + 1) % images.length;
        });
      } else if (e.key === "ArrowLeft") {
        setOpenIndex((prev) => {
          if (prev === null || images.length === 0) return prev;
          return (prev - 1 + images.length) % images.length;
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
  }, [openIndex, images.length]);

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;

    setBusy(true);
    setErr(null);

    try {
      const { data: au } = await supabase.auth.getUser();
      const uid = au.user?.id;
      if (!uid) throw new Error("not logged in");

      const next: PreviewImage[] = [...images];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const key = `${uid}/_new/${crypto.randomUUID()}.${ext}`;
        const previewUrl = URL.createObjectURL(f);

        const up = await supabase.storage.from("product-images").upload(key, f, {
          cacheControl: "3600",
          upsert: false,
        });

        if (up.error) {
          URL.revokeObjectURL(previewUrl);
          throw new Error(up.error.message);
        }

        next.push({
          path: key,
          fileName: f.name,
          previewUrl,
        });
      }

      setImages(next);
      onChange(next.map(({ path, fileName }) => ({ path, fileName })));

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function removeAt(idx: number) {
    const toRemove = images[idx];
    if (toRemove?.previewUrl) {
      URL.revokeObjectURL(toRemove.previewUrl);
    }

    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    onChange(next.map(({ path, fileName }) => ({ path, fileName })));

    setOpenIndex((prev) => {
      if (prev === null) return prev;
      if (next.length === 0) return null;
      if (prev > idx) return prev - 1;
      if (prev === idx) return 0;
      return prev;
    });
  }

  function showPrev() {
    setOpenIndex((prev) => {
      if (prev === null || images.length === 0) return prev;
      return (prev - 1 + images.length) % images.length;
    });
  }

  function showNext() {
    setOpenIndex((prev) => {
      if (prev === null || images.length === 0) return prev;
      return (prev + 1) % images.length;
    });
  }

  const currentImage = openIndex !== null ? images[openIndex] ?? null : null;

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
        {busy ? "Uploading..." : "Upload Images"}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          style={{ display: "none" }}
          onChange={(e) => onPick(e.target.files)}
        />
      </label>

      <div className="spacer" />

      {err ? (
        <div className="badge">
          <span>Error</span>
          <span className="kbd">{err}</span>
        </div>
      ) : null}

      {images.length > 0 ? (
        <>
          <div className="spacer" />
          <div
            className="row"
            style={{
              gap: 14,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            {images.map((im, idx) => (
              <div
                key={im.path}
                className="card"
                style={{
                  width: 220,
                  background: "rgba(255,255,255,0.52)",
                  border: "1px solid rgba(29,27,24,0.08)",
                }}
              >
                <div className="cardInner" style={{ padding: 12 }}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(idx)}
                    style={{
                      width: "100%",
                      height: 220,
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid rgba(29,27,24,0.08)",
                      background: "rgba(255,255,255,0.92)",
                      marginBottom: 10,
                      padding: 0,
                      cursor: "zoom-in",
                      display: "block",
                    }}
                    aria-label={`Open ${im.fileName}`}
                  >
                    <img
                      src={im.previewUrl}
                      alt={im.fileName || `Upload ${idx + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </button>

                  <div
                    className="p"
                    title={im.fileName}
                    style={{
                      fontSize: 12,
                      lineHeight: 1.5,
                      marginBottom: 10,
                      wordBreak: "break-word",
                    }}
                  >
                    {im.fileName}
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => removeAt(idx)}
                    style={{ width: "100%" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {currentImage ? (
        <div
          onClick={() => setOpenIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,17,17,0.82)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
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

            {images.length > 1 ? (
              <>
                <button
                  type="button"
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
              src={currentImage.previewUrl}
              alt={currentImage.fileName}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
                borderRadius: 12,
              }}
            />

            <div
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
              {openIndex! + 1} / {images.length}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}