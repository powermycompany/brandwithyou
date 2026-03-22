"use client";

import { useEffect, useState } from "react";
import { getLocale, setLocale, t } from "@/lib/i18n";

export default function SettingsPage() {
  const [locale, setLoc] = useState(getLocale());

  useEffect(() => {
    const h = () => setLoc(getLocale());
    window.addEventListener("bw_locale_change", h);
    return () => window.removeEventListener("bw_locale_change", h);
  }, []);

  return (
    <div className="card">
      <div className="cardInner">
        <h1 className="h1">{t("nav.settings")}</h1>
        <div className="spacer" />
        <div className="badge">
          <span>{t("settings.language")}</span>
          <span className="kbd">{locale}</span>
        </div>
        <div className="spacer" />
        <div className="row">
          <button className="btn" onClick={() => setLocale("en")} aria-pressed={locale === "en"}>
            {t("settings.english", "en")}
          </button>
          <button className="btn" onClick={() => setLocale("zh-CN")} aria-pressed={locale === "zh-CN"}>
            {t("settings.chinese", "zh-CN")}
          </button>
        </div>
      </div>
    </div>
  );
}
