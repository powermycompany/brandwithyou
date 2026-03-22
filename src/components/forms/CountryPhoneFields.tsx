"use client";

import { useEffect, useMemo, useState } from "react";
import { allCountries } from "country-telephone-data";

/**
 * Fix hydration mismatch:
 * - Ensure COUNTRIES list is deterministic and identical on server+client render.
 * - Avoid locale-dependent sorting and any nondeterministic ordering.
 * - Use a stable key that cannot collide.
 */

type CountryItem = { name: string; iso2: string; dialCode: string };

function buildCountries(): CountryItem[] {
  const seen = new Set<string>();
  const out: CountryItem[] = [];

  for (const c of allCountries as any[]) {
    const name = String(c?.name ?? "").trim();
    const dial = String(c?.dialCode ?? "").trim();
    const iso2 = String(c?.iso2 ?? "").trim().toUpperCase();

    if (!name || !dial || !iso2) continue;

    // De-dupe by iso2+dial+name (most stable)
    const k = `${iso2}|${dial}|${name}`;
    if (seen.has(k)) continue;
    seen.add(k);

    out.push({ name, iso2, dialCode: dial });
  }

  // Deterministic sort: ASCII compare on uppercased name, tie-break by iso2 then dial
  out.sort((a, b) => {
    const an = a.name.toUpperCase();
    const bn = b.name.toUpperCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    if (a.iso2 < b.iso2) return -1;
    if (a.iso2 > b.iso2) return 1;
    if (a.dialCode < b.dialCode) return -1;
    if (a.dialCode > b.dialCode) return 1;
    return 0;
  });

  return out;
}

const COUNTRIES: CountryItem[] = buildCountries();

function findByName(name: string): CountryItem | null {
  const n = (name || "").trim().toUpperCase();
  if (!n) return null;
  return COUNTRIES.find((c) => c.name.trim().toUpperCase() === n) ?? null;
}

function parsePhone(input: string): { dial: string | null; rest: string } {
  const s = String(input ?? "").trim();
  if (!s) return { dial: null, rest: "" };
  const m = s.match(/^\+(\d{1,4})\s*(.*)$/);
  if (!m) return { dial: null, rest: s };
  return { dial: m[1], rest: (m[2] ?? "").trim() };
}

export default function CountryPhoneFields({
  defaultCountry = "",
  defaultPhone = "",
}: {
  defaultCountry?: string;
  defaultPhone?: string;
}) {
  const initial = useMemo(() => {
    const parsed = parsePhone(defaultPhone);
    const byName = findByName(defaultCountry);
    const dial = byName?.dialCode ?? parsed.dial ?? "";
    const country = byName?.name ?? (defaultCountry || "");
    return { country, dial, rest: parsed.rest };
  }, [defaultCountry, defaultPhone]);

  const [country, setCountry] = useState<string>(initial.country);
  const [dial, setDial] = useState<string>(initial.dial);
  const [rest, setRest] = useState<string>(initial.rest);

  useEffect(() => {
    const c = findByName(country);
    if (c?.dialCode) setDial(c.dialCode);
  }, [country]);

  const phoneFull = useMemo(() => {
    const r = (rest ?? "").trim();
    if (!dial) return r;
    return r ? `+${dial} ${r}` : `+${dial}`;
  }, [dial, rest]);

  return (
    <div className="row">
      <div style={{ flex: "1 1 280px" }}>
        <label className="p">Country</label>
        <div className="spacer" style={{ height: 6 }} />
        <select className="input" name="country" value={country} onChange={(e) => setCountry(e.target.value)} required>
          <option value="">Select country…</option>
          {COUNTRIES.map((c) => (
            <option key={`${c.iso2}-${c.dialCode}`} value={c.name}>
              {c.name} (+{c.dialCode})
            </option>
          ))}
        </select>
      </div>

      <div style={{ flex: "0 0 160px" }}>
        <label className="p">Dial</label>
        <div className="spacer" style={{ height: 6 }} />
        <input className="input" value={dial ? `+${dial}` : ""} readOnly aria-label="Dial code" />
      </div>

      <div style={{ flex: "1 1 280px" }}>
        <label className="p">Phone</label>
        <div className="spacer" style={{ height: 6 }} />
        <input className="input" value={rest} onChange={(e) => setRest(e.target.value)} placeholder="Phone number" />
        <input type="hidden" name="phone" value={phoneFull} />
      </div>
    </div>
  );
}
