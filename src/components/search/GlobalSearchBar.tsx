"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

export default function GlobalSearchBar({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const [ph, setPh] = useState(t("market.search.placeholder"));

  useEffect(() => {
    const h = () => setPh(t("market.search.placeholder"));
    window.addEventListener("bw_locale_change", h);
    return () => window.removeEventListener("bw_locale_change", h);
  }, []);

  return (
    <div className="row" style={{ alignItems: "center" }}>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        aria-label="Search"
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
      />
      <button className="btn btnPrimary" onClick={onSubmit}>
        Search
      </button>
    </div>
  );
}
