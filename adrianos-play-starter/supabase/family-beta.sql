-- AdrianOS family beta cloud storage
-- Run in the Supabase SQL editor for the project used by this deployment.

create table if not exists public.adrianos_family_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.adrianos_family_snapshots enable row level security;

drop policy if exists "Families can read their own snapshot" on public.adrianos_family_snapshots;
create policy "Families can read their own snapshot"
on public.adrianos_family_snapshots
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Families can create their own snapshot" on public.adrianos_family_snapshots;
create policy "Families can create their own snapshot"
on public.adrianos_family_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Families can update their own snapshot" on public.adrianos_family_snapshots;
create policy "Families can update their own snapshot"
on public.adrianos_family_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Families can delete their own snapshot" on public.adrianos_family_snapshots;
create policy "Families can delete their own snapshot"
on public.adrianos_family_snapshots
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.adrianos_family_snapshots to authenticated;
