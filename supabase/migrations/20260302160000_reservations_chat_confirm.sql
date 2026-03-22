begin;

create type public.reservation_status as enum ('requested','confirmed','completed','cancelled');

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  quantity int not null default 1,
  status public.reservation_status not null default 'requested',
  cancel_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz null,
  completed_at timestamptz null
);

create index if not exists idx_reservations_product on public.reservations (product_id);
create index if not exists idx_reservations_supplier on public.reservations (supplier_id);
create index if not exists idx_reservations_customer on public.reservations (customer_id);
create index if not exists idx_reservations_status on public.reservations (status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_reservations_updated_at') then
    create trigger trg_reservations_updated_at
    before update on public.reservations
    for each row execute function public.set_updated_at();
  end if;
end $$;

create table if not exists public.reservation_chats (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.reservation_chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message_text text null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  storage_path text not null,
  file_type text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_chat on public.chat_messages (chat_id, created_at);
create index if not exists idx_chat_attachments_message on public.chat_attachments (message_id);

alter table public.reservations enable row level security;
alter table public.reservation_chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_attachments enable row level security;

drop policy if exists "reservations_admin_all" on public.reservations;
create policy "reservations_admin_all"
on public.reservations for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "reservations_customer_own" on public.reservations;
create policy "reservations_customer_own"
on public.reservations
for all
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role='customer')
  and auth.uid() = customer_id
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role='customer')
  and auth.uid() = customer_id
);

drop policy if exists "reservations_supplier_own" on public.reservations;
create policy "reservations_supplier_own"
on public.reservations
for all
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role='supplier')
  and auth.uid() = supplier_id
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.status='active' and p.role='supplier')
  and auth.uid() = supplier_id
);

drop policy if exists "chats_admin_all" on public.reservation_chats;
create policy "chats_admin_all"
on public.reservation_chats
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "chats_participants" on public.reservation_chats;
create policy "chats_participants"
on public.reservation_chats
for select
using (
  exists (
    select 1
    from public.reservations r
    where r.id = reservation_id
      and (r.customer_id = auth.uid() or r.supplier_id = auth.uid())
  )
);

drop policy if exists "messages_admin_all" on public.chat_messages;
create policy "messages_admin_all"
on public.chat_messages
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "messages_participants" on public.chat_messages;
create policy "messages_participants"
on public.chat_messages
for all
using (
  exists (
    select 1
    from public.reservation_chats c
    join public.reservations r on r.id = c.reservation_id
    where c.id = chat_id
      and (r.customer_id = auth.uid() or r.supplier_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.reservation_chats c
    join public.reservations r on r.id = c.reservation_id
    where c.id = chat_id
      and (r.customer_id = auth.uid() or r.supplier_id = auth.uid())
  )
);

drop policy if exists "attachments_admin_all" on public.chat_attachments;
create policy "attachments_admin_all"
on public.chat_attachments
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "attachments_participants" on public.chat_attachments;
create policy "attachments_participants"
on public.chat_attachments
for all
using (
  exists (
    select 1
    from public.chat_messages m
    join public.reservation_chats c on c.id = m.chat_id
    join public.reservations r on r.id = c.reservation_id
    where m.id = message_id
      and (r.customer_id = auth.uid() or r.supplier_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.chat_messages m
    join public.reservation_chats c on c.id = m.chat_id
    join public.reservations r on r.id = c.reservation_id
    where m.id = message_id
      and (r.customer_id = auth.uid() or r.supplier_id = auth.uid())
  )
);

create or replace function public.confirm_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_supplier_id uuid;
  v_qty int;
  v_available int;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status='active' and p.role='supplier'
  ) then
    raise exception 'not authorized';
  end if;

  select r.product_id, r.supplier_id, r.quantity
    into v_product_id, v_supplier_id, v_qty
  from public.reservations r
  where r.id = p_reservation_id
  for update;

  if v_product_id is null then
    raise exception 'reservation not found';
  end if;

  if v_supplier_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  select quantity_available into v_available
  from public.products
  where id = v_product_id
  for update;

  if v_available < v_qty then
    raise exception 'insufficient inventory';
  end if;

  update public.reservations
  set status='confirmed', confirmed_at=now()
  where id = p_reservation_id
    and status='requested';

  update public.products
  set quantity_available = quantity_available - v_qty
  where id = v_product_id;

  select quantity_available into v_available
  from public.products
  where id = v_product_id;

  if v_available <= 0 then
    update public.reservations
    set status='cancelled', cancel_reason='auto_cancel_competing', updated_at=now()
    where product_id = v_product_id
      and status='requested'
      and id <> p_reservation_id;
  end if;
end;
$$;

grant execute on function public.confirm_reservation(uuid) to authenticated;

commit;
