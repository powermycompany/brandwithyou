drop function if exists public.search_market_products(text,bigint,bigint,public.product_condition);

create or replace function public.search_market_products(
  p_query text,
  p_brand_id bigint default null,
  p_category_id bigint default null,
  p_condition public.product_condition default null
)
returns table(
  id uuid,
  product_name text,
  reference_code text,
  condition public.product_condition,
  currency char(3),
  final_price numeric,
  brand_id bigint,
  brand_en text,
  brand_zh text,
  main_category_id bigint,
  main_category_en text,
  main_category_zh text,
  product_type_id bigint,
  product_type_en text,
  product_type_zh text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status='active' and p.role in ('customer','supplier','admin')
  ) then
    raise exception 'not authorized';
  end if;

  return query
  select
    pr.id,
    pr.product_name,
    pr.reference_code,
    pr.condition,
    pr.currency,
    round(ps.base_price * (1 + (coalesce(m.margin_pct,0)/100.0)), 2) as final_price,
    pr.brand_id,
    b.name_en::text as brand_en,
    b.name_zh as brand_zh,
    pr.main_category_id,
    mc.name_en::text as main_category_en,
    mc.name_zh as main_category_zh,
    pr.product_type_id,
    pt.name_en::text as product_type_en,
    pt.name_zh as product_type_zh
  from public.products pr
  join public.product_supplier_pricing ps on ps.product_id = pr.id
  left join public.supplier_margin_rules m on m.supplier_id = pr.supplier_id
  join public.catalog_brands b on b.id = pr.brand_id
  join public.catalog_main_categories mc on mc.id = pr.main_category_id
  join public.catalog_product_types pt on pt.id = pr.product_type_id
  where pr.status='published'
    and (p_brand_id is null or pr.brand_id = p_brand_id)
    and (p_category_id is null or pr.main_category_id = p_category_id)
    and (p_condition is null or pr.condition = p_condition)
    and (
      p_query is null or p_query = '' or
      pr.search_tsv @@ plainto_tsquery('simple', p_query) or
      pr.product_name % p_query or
      pr.reference_code % p_query or
      pr.color % p_query or
      pr.material % p_query
    )
  order by pr.created_at desc;
end;
$$;

grant execute on function public.search_market_products(text,bigint,bigint,public.product_condition) to authenticated;