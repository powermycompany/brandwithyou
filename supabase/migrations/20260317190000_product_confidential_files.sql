begin;

create table if not exists public.product_confidential_files (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text null,
  mime_type text null,
  created_at timestamptz not null default now()
);

create index if not exists product_confidential_files_product_idx
  on public.product_confidential_files(product_id, created_at);

create index if not exists product_confidential_files_supplier_idx
  on public.product_confidential_files(supplier_id, created_at);

alter table public.product_confidential_files enable row level security;

drop policy if exists product_confidential_files_select_owner_admin on public.product_confidential_files;
drop policy if exists product_confidential_files_insert_owner on public.product_confidential_files;
drop policy if exists product_confidential_files_delete_owner_admin on public.product_confidential_files;

create policy product_confidential_files_select_owner_admin
on public.product_confidential_files
for select
to authenticated
using (
  supplier_id = auth.uid()
  or public.is_admin()
);

create policy product_confidential_files_insert_owner
on public.product_confidential_files
for insert
to authenticated
with check (
  supplier_id = auth.uid()
);

create policy product_confidential_files_delete_owner_admin
on public.product_confidential_files
for delete
to authenticated
using (
  supplier_id = auth.uid()
  or public.is_admin()
);

insert into storage.buckets (id, name, public)
values ('product-confidential', 'product-confidential', false)
on conflict (id) do nothing;

drop policy if exists "product-confidential read owner admin" on storage.objects;
drop policy if exists "product-confidential insert owner" on storage.objects;
drop policy if exists "product-confidential delete owner admin" on storage.objects;

create policy "product-confidential read owner admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-confidential'
  and (
    owner = auth.uid()
    or public.is_admin()
  )
);

create policy "product-confidential insert owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-confidential'
  and owner = auth.uid()
);

create policy "product-confidential delete owner admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-confidential'
  and (
    owner = auth.uid()
    or public.is_admin()
  )
);

commit;
