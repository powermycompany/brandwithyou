begin;

create extension if not exists pg_trgm;

create type public.product_status as enum ('draft','published','archived');
create type public.product_condition as enum ('new','secondhand');
create type public.product_gender as enum ('men','women','unisex');

create table if not exists public.supplier_margin_rules (
  supplier_id uuid primary key references public.profiles(id) on delete cascade,
  margin_pct numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete cascade,

  main_category_id bigint not null references public.catalog_main_categories(id) on delete restrict,
  brand_id bigint not null references public.catalog_brands(id) on delete restrict,
  brand_subcategory_id bigint not null references public.catalog_brand_subcategories(id) on delete restrict,
  product_type_id bigint not null references public.catalog_product_types(id) on delete restrict,

  product_name text not null,
  gender public.product_gender not null default 'unisex',
  reference_code text not null,
  serial_number text null,

  condition public.product_condition not null,
  retail_price numeric not null,
  currency char(3) not null default 'USD',

  color text not null,
  material text not null,
  hardware_details text null,
  size_specs text null,
  description text null,

  quantity_total int not null default 1,
  quantity_available int not null default 1,

  status public.product_status not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_supplier_pricing (
  product_id uuid primary key references public.products(id) on delete cascade,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  base_price numeric not null,
  currency char(3) not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_receipts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_supplier on public.products (supplier_id);
create index if not exists idx_products_status on public.products (status);
create index if not exists idx_products_ref_trgm on public.products using gin (reference_code gin_trgm_ops);
create index if not exists idx_products_name_trgm on public.products using gin (product_name gin_trgm_ops);

create index if not exists idx_images_product on public.product_images (product_id);

create or replace function public.trg_validate_catalog_combination()
returns trigger language plpgsql as $$
begin
  if not public.is_valid_catalog_combination(new.main_category_id, new.brand_id, new.brand_subcategory_id, new.product_type_id) then
    raise exception 'Invalid catalog combination';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_products_validate_catalog') then
    create trigger trg_products_validate_catalog
    before insert or update on public.products
    for each row execute function public.trg_validate_catalog_combination();
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_products_updated_at') then
    create trigger trg_products_updated_at
    before update on public.products
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_product_supplier_pricing_updated_at') then
    create trigger trg_product_supplier_pricing_updated_at
    before update on public.product_supplier_pricing
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.supplier_margin_rules enable row level security;
alter table public.products enable row level security;
alter table public.product_supplier_pricing enable row level security;
alter table public.product_images enable row level security;
alter table public.product_receipts enable row level security;

drop policy if exists "margin_admin_all" on public.supplier_margin_rules;
create policy "margin_admin_all"
on public.supplier_margin_rules
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all"
on public.products
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products_supplier_own" on public.products;
create policy "products_supplier_own"
on public.products
for all
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role='supplier')
  and auth.uid() = supplier_id
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role='supplier')
  and auth.uid() = supplier_id
);

drop policy if exists "products_customer_read_published" on public.products;
create policy "products_customer_read_published"
on public.products
for select
using (
  status = 'published'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role in ('customer','supplier','admin'))
);

drop policy if exists "pricing_admin_all" on public.product_supplier_pricing;
create policy "pricing_admin_all"
on public.product_supplier_pricing
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "pricing_supplier_own" on public.product_supplier_pricing;
create policy "pricing_supplier_own"
on public.product_supplier_pricing
for all
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role='supplier')
  and auth.uid() = supplier_id
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role='supplier')
  and auth.uid() = supplier_id
);

drop policy if exists "images_admin_all" on public.product_images;
create policy "images_admin_all"
on public.product_images
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "images_supplier_own" on public.product_images;
create policy "images_supplier_own"
on public.product_images
for all
using (
  exists (select 1 from public.products pr where pr.id = product_id and pr.supplier_id = auth.uid())
)
with check (
  exists (select 1 from public.products pr where pr.id = product_id and pr.supplier_id = auth.uid())
);

drop policy if exists "images_member_read_published" on public.product_images;
create policy "images_member_read_published"
on public.product_images
for select
using (
  exists (
    select 1
    from public.products pr
    join public.profiles p on p.id = auth.uid()
    where pr.id = product_id
      and pr.status = 'published'
      and p.status = 'active'
      and p.role in ('customer','supplier','admin')
  )
);

drop policy if exists "receipts_admin_only" on public.product_receipts;
create policy "receipts_admin_only"
on public.product_receipts
for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.get_product_customer_detail(p_product_id uuid)
returns table(
  id uuid,
  supplier_id uuid,
  product_name text,
  reference_code text,
  serial_number text,
  condition public.product_condition,
  retail_price numeric,
  currency char(3),
  color text,
  material text,
  hardware_details text,
  size_specs text,
  description text,
  quantity_available int,
  main_category_id bigint,
  brand_id bigint,
  brand_subcategory_id bigint,
  product_type_id bigint,
  final_price numeric,
  margin_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_margin numeric(5,2);
  v_base numeric;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status='active' and p.role in ('customer','supplier','admin')
  ) then
    raise exception 'not authorized';
  end if;

  select coalesce(m.margin_pct, 0)
  into v_margin
  from public.products pr
  left join public.supplier_margin_rules m on m.supplier_id = pr.supplier_id
  where pr.id = p_product_id;

  select base_price into v_base
  from public.product_supplier_pricing ps
  where ps.product_id = p_product_id;

  return query
  select
    pr.id,
    pr.supplier_id,
    pr.product_name,
    pr.reference_code,
    pr.serial_number,
    pr.condition,
    pr.retail_price,
    pr.currency,
    pr.color,
    pr.material,
    pr.hardware_details,
    pr.size_specs,
    pr.description,
    pr.quantity_available,
    pr.main_category_id,
    pr.brand_id,
    pr.brand_subcategory_id,
    pr.product_type_id,
    round(v_base * (1 + (v_margin/100.0)), 2) as final_price,
    round((v_base * (v_margin/100.0)), 2) as margin_amount
  from public.products pr
  where pr.id = p_product_id
    and pr.status = 'published';
end;
$$;

create or replace function public.get_market_products()
returns table(
  id uuid,
  product_name text,
  reference_code text,
  condition public.product_condition,
  currency char(3),
  final_price numeric,
  brand_id bigint,
  main_category_id bigint,
  product_type_id bigint
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
    pr.main_category_id,
    pr.product_type_id
  from public.products pr
  join public.product_supplier_pricing ps on ps.product_id = pr.id
  left join public.supplier_margin_rules m on m.supplier_id = pr.supplier_id
  where pr.status = 'published'
  order by pr.created_at desc;
end;
$$;

grant execute on function public.get_product_customer_detail(uuid) to authenticated;
grant execute on function public.get_market_products() to authenticated;

commit;
