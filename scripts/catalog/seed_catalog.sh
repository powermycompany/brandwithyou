#!/usr/bin/env bash
set -euo pipefail

XLSX="${1:-./luxury_platform_category_brand_combinations_alt10.xlsx}"
OUT_SQL="${2:-supabase/seed/catalog/020_catalog_seed.sql}"

python scripts/catalog/import_xlsx_to_seed_sql.py --xlsx "$XLSX" --out "$OUT_SQL"

if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$OUT_SQL"
else
  supabase db execute -f "$OUT_SQL"
fi
