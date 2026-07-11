create table if not exists public.adrianos_family_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.adrianos_family_snapshots enable row level security;

create policy "Parents can read their own AdrianOS snapshot"
on public.adrianos_family_snapshots
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Parents can insert their own AdrianOS snapshot"
on public.adrianos_family_snapshots
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Parents can update their own AdrianOS snapshot"
on public.adrianos_family_snapshots
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists adrianos_family_snapshots_updated_at_idx
  on public.adrianos_family_snapshots (updated_at desc);
