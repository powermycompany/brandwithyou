export type MarketProductRow = {
  id: string;
  product_name: string;
  reference_code: string;
  condition: "new" | "secondhand";
  currency: string;
  final_price: number;

  brand_id: number;
  brand_en: string | null;
  brand_zh: string | null;

  main_category_id: number;
  main_category_en: string | null;
  main_category_zh: string | null;

  product_type_id: number;
  product_type_en: string | null;
  product_type_zh: string | null;
};
