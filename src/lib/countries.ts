import { allCountries } from "country-telephone-data";

/**
 * country-telephone-data: allCountries items look like:
 * [name, iso2, dialCode, priority, areaCodes]
 */
export type CountryOption = {
  name: string;
  iso2: string;
  dialCode: string; // without "+"
};

export const COUNTRIES: CountryOption[] = (allCountries as any[])
  .map((c) => ({
    name: String(c[0]),
    iso2: String(c[1]).toUpperCase(),
    dialCode: String(c[2]),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function findCountryByName(name: string | null | undefined): CountryOption | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === n) ?? null;
}

export function findCountryByIso2(iso2: string | null | undefined): CountryOption | null {
  if (!iso2) return null;
  const x = iso2.trim().toUpperCase();
  return COUNTRIES.find((c) => c.iso2 === x) ?? null;
}
