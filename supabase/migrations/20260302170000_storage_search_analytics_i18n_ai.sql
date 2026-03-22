begin;

create extension if not exists pg_trgm;

-- -------------------------
-- 54) AI metadata + logs
-- -------------------------
create table if not exists public.product_ai_metadata (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  model_name text not null,
  ai_generated_data jsonb not null default '{}'::jsonb,
  ai_field_confidence jsonb not null default '{}'::jsonb,
  ai_confidence_score numeric null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid null references public.products(id) on delete set null,
  action text not null,
  model_name text not null,
  latency_ms int null,
  cost_estimate numeric null,
  created_at timestamptz not null default now()
);

alter table public.product_ai_metadata enable row level security;
alter table public.ai_usage_logs enable row level security;

drop policy if exists "ai_meta_admin_all" on public.product_ai_metadata;
create policy "ai_meta_admin_all"
on public.product_ai_metadata for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "ai_meta_supplier_own" on public.product_ai_metadata;
create policy "ai_meta_supplier_own"
on public.product_ai_metadata
for all
using (
  exists (select 1 from public.products pr where pr.id = product_id and pr.supplier_id = auth.uid())
)
with check (
  exists (select 1 from public.products pr where pr.id = product_id and pr.supplier_id = auth.uid())
);

drop policy if exists "ai_logs_admin_all" on public.ai_usage_logs;
create policy "ai_logs_admin_all"
on public.ai_usage_logs for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "ai_logs_supplier_own" on public.ai_usage_logs;
create policy "ai_logs_supplier_own"
on public.ai_usage_logs
for all
using (auth.uid() = supplier_id)
with check (auth.uid() = supplier_id);

-- -------------------------
-- 50) Admin analytics snapshots
-- -------------------------
create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period in ('weekly','monthly')),
  range_start date not null,
  range_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (period, range_start, range_end)
);

alter table public.analytics_snapshots enable row level security;

drop policy if exists "analytics_admin_only" on public.analytics_snapshots;
create policy "analytics_admin_only"
on public.analytics_snapshots
for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.get_admin_metrics(p_start date, p_end date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'new_suppliers', (select count(*) from public.profiles where role='supplier' and created_at::date between p_start and p_end),
    'new_customers', (select count(*) from public.profiles where role='customer' and created_at::date between p_start and p_end),
    'new_products', (select count(*) from public.products where created_at::date between p_start and p_end),
    'ai_usage', (select count(*) from public.ai_usage_logs where created_at::date between p_start and p_end),
    'requested_reservations', (select count(*) from public.reservations where status='requested' and created_at::date between p_start and p_end),
    'confirmed_transfers', (select count(*) from public.reservations where status='confirmed' and confirmed_at::date between p_start and p_end),
    'completed_transfers', (select count(*) from public.reservations where status='completed' and completed_at::date between p_start and p_end),
    'cancelled_reservations', (select count(*) from public.reservations where status='cancelled' and updated_at::date between p_start and p_end)
  ) into v;

  return v;
end;
$$;

grant execute on function public.get_admin_metrics(date,date) to authenticated;

-- -------------------------
-- 52) Search indexes + RPC search
-- -------------------------
alter table public.products add column if not exists search_tsv tsvector;

create or replace function public.products_search_tsv_update()
returns trigger language plpgsql as $$
begin
  new.search_tsv :=
    to_tsvector(
      'simple',
      coalesce(new.product_name,'') || ' ' ||
      coalesce(new.reference_code,'') || ' ' ||
      coalesce(new.serial_number,'') || ' ' ||
      coalesce(new.color,'') || ' ' ||
      coalesce(new.material,'') || ' ' ||
      coalesce(new.description,'')
    );
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_products_search_tsv') then
    create trigger trg_products_search_tsv
    before insert or update on public.products
    for each row execute function public.products_search_tsv_update();
  end if;
end $$;

create index if not exists idx_products_search_tsv on public.products using gin (search_tsv);
create index if not exists idx_products_color_trgm on public.products using gin (color gin_trgm_ops);
create index if not exists idx_products_material_trgm on public.products using gin (material gin_trgm_ops);

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

-- -------------------------
-- 46/47) Storage buckets policies (storage.objects)
-- NOTE: Requires buckets:
-- - product-images
-- - chat-attachments
-- - confidential-receipts
-- -------------------------
create or replace function public.is_active_member()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status='active'
      and p.role in ('admin','supplier','customer')
  );
$$;

alter table storage.objects enable row level security;

-- product-images: members can read; supplier (owner) can write their own product images; admin all
drop policy if exists "storage_product_images_read_members" on storage.objects;
create policy "storage_product_images_read_members"
on storage.objects for select
using (
  bucket_id = 'product-images'
  and public.is_active_member()
);

drop policy if exists "storage_product_images_write_supplier" on storage.objects;
create policy "storage_product_images_write_supplier"
on storage.objects for insert
with check (
  bucket_id = 'product-images'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status='active' and p.role in ('supplier','admin')
  )
);

drop policy if exists "storage_product_images_delete_supplier_admin" on storage.objects;
create policy "storage_product_images_delete_supplier_admin"
on storage.objects for delete
using (
  bucket_id = 'product-images'
  and (
    public.is_admin()
    or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='supplier' and p.status='active')
  )
);

-- chat-attachments: only reservation participants + admin
drop policy if exists "storage_chat_attachments_participants" on storage.objects;
create policy "storage_chat_attachments_participants"
on storage.objects for select
using (
  bucket_id = 'chat-attachments'
  and (
    public.is_admin()
    or exists (select 1 from public.profiles p where p.id=auth.uid() and p.status='active' and p.role in ('supplier','customer'))
  )
);

drop policy if exists "storage_chat_attachments_write_members" on storage.objects;
create policy "storage_chat_attachments_write_members"
on storage.objects for insert
with check (
  bucket_id = 'chat-attachments'
  and exists (select 1 from public.profiles p where p.id=auth.uid() and p.status='active' and p.role in ('supplier','customer','admin'))
);

-- confidential-receipts: admin only
drop policy if exists "storage_confidential_receipts_admin_only" on storage.objects;
create policy "storage_confidential_receipts_admin_only"
on storage.objects for all
using (
  bucket_id = 'confidential-receipts' and public.is_admin()
)
with check (
  bucket_id = 'confidential-receipts' and public.is_admin()
);

commit;
