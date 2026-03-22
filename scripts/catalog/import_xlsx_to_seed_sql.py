#!/usr/bin/env python3
import argparse
import re
from pathlib import Path
import pandas as pd

REQUIRED_COLS = ["Main Category", "Brand", "Brand Subcategory", "Product Type"]

def norm(v):
  if v is None:
    return ""
  s = str(v).strip()
  return re.sub(r"\s+", " ", s)

def q(s: str) -> str:
  return "'" + s.replace("'", "''") + "'"

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument("--xlsx", required=True)
  ap.add_argument("--out", required=True)
  ap.add_argument("--category", default=None)
  ap.add_argument("--no-tx", dest="no_tx", action="store_true")
  ap.add_argument("--no_tx", dest="no_tx", action="store_true")
  args = ap.parse_args()

  xlsx = Path(args.xlsx).expanduser().resolve()
  out = Path(args.out).expanduser().resolve()
  out.parent.mkdir(parents=True, exist_ok=True)

  df = pd.read_excel(xlsx, engine="openpyxl")
  missing = [c for c in REQUIRED_COLS if c not in df.columns]
  if missing:
    raise SystemExit(f"Missing columns: {missing}. Found: {list(df.columns)}")

  df = df[REQUIRED_COLS].copy()
  for c in REQUIRED_COLS:
    df[c] = df[c].map(norm)

  df = df[(df["Main Category"] != "") & (df["Brand"] != "") & (df["Brand Subcategory"] != "") & (df["Product Type"] != "")]
  df = df.drop_duplicates()

  if args.category:
    df = df[df["Main Category"] == args.category].copy()
    if df.empty:
      raise SystemExit(f"No rows found for category: {args.category}")

  main_categories = sorted(df["Main Category"].unique().tolist())
  brands = sorted(df["Brand"].unique().tolist())
  product_types = sorted(df["Product Type"].unique().tolist())

  brand_subcats = (
    df[["Brand", "Brand Subcategory"]]
    .drop_duplicates()
    .sort_values(["Brand", "Brand Subcategory"])
    .values.tolist()
  )

  combos = df[REQUIRED_COLS].sort_values(REQUIRED_COLS).values.tolist()

  lines = []
  lines.append("-- AUTO-GENERATED. DO NOT EDIT.")
  lines.append(f"-- Source: {xlsx.name}")
  if args.category:
    lines.append(f"-- Filter: Main Category = {args.category}")
  if not args.no_tx:
    lines.append("begin;")
  lines.append("create extension if not exists citext;")
  lines.append("create extension if not exists pg_trgm;")
  lines.append("")
  lines.append("-- Main Categories")
  for mc in main_categories:
    lines.append(f"insert into public.catalog_main_categories (name_en) values ({q(mc)}) on conflict (name_en) do nothing;")
  lines.append("")
  lines.append("-- Brands")
  for b in brands:
    lines.append(f"insert into public.catalog_brands (name_en) values ({q(b)}) on conflict (name_en) do nothing;")
  lines.append("")
  lines.append("-- Product Types")
  for pt in product_types:
    lines.append(f"insert into public.catalog_product_types (name_en) values ({q(pt)}) on conflict (name_en) do nothing;")
  lines.append("")
  lines.append("-- Brand Subcategories")
  for brand, subcat in brand_subcats:
    lines.append(
      "insert into public.catalog_brand_subcategories (brand_id, name_en) values "
      f"((select id from public.catalog_brands where name_en = {q(brand)}), {q(subcat)}) "
      "on conflict (brand_id, name_en) do nothing;"
    )
  lines.append("")
  lines.append("-- Combinations")
  for mc, brand, subcat, ptype in combos:
    lines.append(
      "insert into public.catalog_combinations (main_category_id, brand_id, brand_subcategory_id, product_type_id) values ("
      f"(select id from public.catalog_main_categories where name_en = {q(mc)}), "
      f"(select id from public.catalog_brands where name_en = {q(brand)}), "
      f"(select bs.id from public.catalog_brand_subcategories bs join public.catalog_brands b on b.id = bs.brand_id "
      f" where b.name_en = {q(brand)} and bs.name_en = {q(subcat)}), "
      f"(select id from public.catalog_product_types where name_en = {q(ptype)})"
      ") on conflict (main_category_id, brand_id, brand_subcategory_id, product_type_id) do nothing;"
    )
  if not args.no_tx:
    lines.append("commit;")
  lines.append("")
  out.write_text("\n".join(lines), encoding="utf-8")
  print(f"OK: wrote {out}")

if __name__ == "__main__":
  main()
