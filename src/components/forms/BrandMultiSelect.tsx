"use client";

import { useMemo, useState } from "react";

type Brand = { id: number; name_en: string | null };

export default function BrandMultiSelect({
  name,
  brands,
  defaultSelectedIds = [],
  title,
  subtitle,
}: {
  name: string;
  brands: Brand[];
  defaultSelectedIds?: number[];
  title: string;
  subtitle?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number[]>(defaultSelectedIds);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const selectedBrands = useMemo(() => {
    const map = new Map<number, string>();
    for (const b of brands) map.set(b.id, b.name_en ?? String(b.id));
    return selected
      .map((id) => ({ id, label: map.get(id) ?? `#${id}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [brands, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => (b.name_en ?? "").toLowerCase().includes(q) || String(b.id).includes(q));
  }, [brands, query]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function clearAll() {
    setSelected([]);
  }

  function removeOne(id: number) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  return (
    <div className="card">
      <div className="cardInner">
        <div className="row brandMultiHeader" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 650, fontSize: 18 }}>{title}</div>
            {subtitle ? <p className="p">{subtitle}</p> : null}
          </div>

          <div className="row brandMultiHeaderActions" style={{ gap: 10, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <div className="badge">
              <span>Selected</span>
              <span className="kbd">{selected.length}</span>
            </div>
            <button className="btn brandMultiClearButton" type="button" onClick={clearAll} disabled={selected.length === 0}>
              Clear
            </button>
          </div>
        </div>

        <input type="hidden" name={name} value={JSON.stringify(selected)} />

        <div className="spacer" />

        {selectedBrands.length > 0 ? (
          <>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              {selectedBrands.map((b) => (
                <div key={b.id} className="badge" style={{ gap: 10 }}>
                  <span>{b.label}</span>
                  <button
                    type="button"
                    className="kbd"
                    onClick={() => removeOne(b.id)}
                    style={{ cursor: "pointer" }}
                    aria-label={`Remove ${b.label}`}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="spacer" />
          </>
        ) : null}

        <div className="row brandMultiSearchRow" style={{ alignItems: "center", gap: 10 }}>
          <div className="brandMultiSearchInputWrap" style={{ flex: "1 1 420px" }}>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brands…"
              aria-label="Search brands"
            />
          </div>
          <div className="badge">
            <span>Matches</span>
            <span className="kbd">{filtered.length}</span>
          </div>
        </div>

        <div className="spacer" />

        <div
          className="card"
          style={{
            maxHeight: 320,
            minHeight: 220,
            overflow: "auto",
          }}
        >
          <div className="cardInner" style={{ padding: 12 }}>
            {filtered.length === 0 ? (
              <p className="p">No matches.</p>
            ) : (
              <div className="row" style={{ flexDirection: "column", gap: 8 }}>
                {filtered.map((b) => {
                  const checked = selectedSet.has(b.id);
                  return (
                    <label
                      key={b.id}
                      className="row brandMultiOptionRow"
                      style={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: checked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                        cursor: "pointer",
                      }}
                    >
                      <div className="brandMultiOptionLabelWrap" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(b.id)}
                          style={{ transform: "translateY(1px)" }}
                        />
                        <div className="brandMultiOptionLabel" style={{ fontWeight: 600 }}>{b.name_en ?? `#${b.id}`}</div>
                      </div>

                      {checked ? (
                        <div className="badge">
                          <span>Selected</span>
                          <span className="kbd">✓</span>
                        </div>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="spacer" />
        <p className="p">Tip: search + select multiple. Your selection stays visible above.</p>
      </div>
    </div>
  );
}