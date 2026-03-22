type Locale = "en" | "zh-CN";

const en = {
  "nav.market": "Market",
  "nav.reservations": "Reservations",
  "nav.settings": "Settings",
  "settings.language": "Language",
  "settings.english": "English",
  "settings.chinese": "Chinese (Simplified)",
  "market.search.placeholder": "Search brand, name, reference code, color, material…",
  "market.filters": "Filters",
};

const zhCN = {
  "nav.market": "市场",
  "nav.reservations": "预订",
  "nav.settings": "设置",
  "settings.language": "语言",
  "settings.english": "英文",
  "settings.chinese": "中文（简体）",
  "market.search.placeholder": "搜索品牌、名称、参考编号、颜色、材质…",
  "market.filters": "筛选",
};

const dict: Record<Locale, Record<string, string>> = { en, "zh-CN": zhCN };

export function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const v = window.localStorage.getItem("bw_locale");
  return v === "zh-CN" ? "zh-CN" : "en";
}

export function setLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("bw_locale", locale);
  window.dispatchEvent(new Event("bw_locale_change"));
}

export function t(key: string, locale?: Locale) {
  const l = locale ?? (typeof window === "undefined" ? "en" : getLocale());
  return dict[l][key] ?? dict["en"][key] ?? key;
}

export function labelByLocale(opts: { en?: string | null; zh?: string | null }, locale?: Locale) {
  const l = locale ?? (typeof window === "undefined" ? "en" : getLocale());
  if (l === "zh-CN") return (opts.zh && opts.zh.trim()) ? opts.zh : (opts.en ?? "");
  return (opts.en && opts.en.trim()) ? opts.en : (opts.zh ?? "");
}
