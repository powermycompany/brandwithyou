begin;

create extension if not exists citext;
create extension if not exists pg_trgm;

create table if not exists public.catalog_main_categories (
  id bigserial primary key,
  name_en citext not null unique,
  name_zh text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_brands (
  id bigserial primary key,
  name_en citext not null unique,
  name_zh text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_brand_subcategories (
  id bigserial primary key,
  brand_id bigint not null references public.catalog_brands(id) on delete cascade,
  name_en citext not null,
  name_zh text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_brand_subcategory unique (brand_id, name_en)
);

create table if not exists public.catalog_product_types (
  id bigserial primary key,
  name_en citext not null unique,
  name_zh text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_combinations (
  id bigserial primary key,
  main_category_id bigint not null references public.catalog_main_categories(id) on delete restrict,
  brand_id bigint not null references public.catalog_brands(id) on delete restrict,
  brand_subcategory_id bigint not null references public.catalog_brand_subcategories(id) on delete restrict,
  product_type_id bigint not null references public.catalog_product_types(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint uq_catalog_combination unique (main_category_id, brand_id, brand_subcategory_id, product_type_id)
);

create index if not exists idx_catalog_main_categories_name_trgm on public.catalog_main_categories using gin (name_en gin_trgm_ops);
create index if not exists idx_catalog_brands_name_trgm on public.catalog_brands using gin (name_en gin_trgm_ops);
create index if not exists idx_catalog_brand_subcategories_name_trgm on public.catalog_brand_subcategories using gin (name_en gin_trgm_ops);
create index if not exists idx_catalog_product_types_name_trgm on public.catalog_product_types using gin (name_en gin_trgm_ops);

create index if not exists idx_catalog_combinations_brand on public.catalog_combinations (brand_id);
create index if not exists idx_catalog_combinations_category on public.catalog_combinations (main_category_id);
create index if not exists idx_catalog_combinations_subcat on public.catalog_combinations (brand_subcategory_id);
create index if not exists idx_catalog_combinations_ptype on public.catalog_combinations (product_type_id);

create or replace view public.catalog_combinations_view as
select
  cc.id as combination_id,
  mc.id as main_category_id,
  mc.name_en as main_category_en,
  mc.name_zh as main_category_zh,
  b.id as brand_id,
  b.name_en as brand_en,
  b.name_zh as brand_zh,
  bs.id as brand_subcategory_id,
  bs.name_en as brand_subcategory_en,
  bs.name_zh as brand_subcategory_zh,
  pt.id as product_type_id,
  pt.name_en as product_type_en,
  pt.name_zh as product_type_zh
from public.catalog_combinations cc
join public.catalog_main_categories mc on mc.id = cc.main_category_id
join public.catalog_brands b on b.id = cc.brand_id
join public.catalog_brand_subcategories bs on bs.id = cc.brand_subcategory_id
join public.catalog_product_types pt on pt.id = cc.product_type_id;

create or replace function public.is_valid_catalog_combination(
  p_main_category_id bigint,
  p_brand_id bigint,
  p_brand_subcategory_id bigint,
  p_product_type_id bigint
)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.catalog_combinations
    where main_category_id = p_main_category_id
      and brand_id = p_brand_id
      and brand_subcategory_id = p_brand_subcategory_id
      and product_type_id = p_product_type_id
  );
$$;

alter table public.catalog_main_categories enable row level security;
alter table public.catalog_brands enable row level security;
alter table public.catalog_brand_subcategories enable row level security;
alter table public.catalog_product_types enable row level security;
alter table public.catalog_combinations enable row level security;

drop policy if exists "catalog_read_active_members_main_categories" on public.catalog_main_categories;
create policy "catalog_read_active_members_main_categories"
on public.catalog_main_categories for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role in ('admin','supplier','customer'))
);

drop policy if exists "catalog_read_active_members_brands" on public.catalog_brands;
create policy "catalog_read_active_members_brands"
on public.catalog_brands for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role in ('admin','supplier','customer'))
);

drop policy if exists "catalog_read_active_members_brand_subcategories" on public.catalog_brand_subcategories;
create policy "catalog_read_active_members_brand_subcategories"
on public.catalog_brand_subcategories for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role in ('admin','supplier','customer'))
);

drop policy if exists "catalog_read_active_members_product_types" on public.catalog_product_types;
create policy "catalog_read_active_members_product_types"
on public.catalog_product_types for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role in ('admin','supplier','customer'))
);

drop policy if exists "catalog_read_active_members_combinations" on public.catalog_combinations;
create policy "catalog_read_active_members_combinations"
on public.catalog_combinations for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role in ('admin','supplier','customer'))
);

drop policy if exists "catalog_write_admin_only_main_categories" on public.catalog_main_categories;
create policy "catalog_write_admin_only_main_categories"
on public.catalog_main_categories for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "catalog_write_admin_only_brands" on public.catalog_brands;
create policy "catalog_write_admin_only_brands"
on public.catalog_brands for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "catalog_write_admin_only_brand_subcategories" on public.catalog_brand_subcategories;
create policy "catalog_write_admin_only_brand_subcategories"
on public.catalog_brand_subcategories for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "catalog_write_admin_only_product_types" on public.catalog_product_types;
create policy "catalog_write_admin_only_product_types"
on public.catalog_product_types for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "catalog_write_admin_only_combinations" on public.catalog_combinations;
create policy "catalog_write_admin_only_combinations"
on public.catalog_combinations for all
using (public.is_admin())
with check (public.is_admin());

commit;
