-- AdrianOS family beta cloud storage and feedback
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

create table if not exists public.adrianos_beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  profile_name text not null,
  cohort text not null default 'general',
  rating smallint not null check (rating between 1 and 5),
  category text not null check (category in ('signup', 'school-mode', 'game', 'progress', 'bug', 'idea', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  contact_allowed boolean not null default true,
  page_path text,
  device text,
  viewport_width integer,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists adrianos_beta_feedback_user_created_idx
on public.adrianos_beta_feedback (user_id, created_at desc);

create index if not exists adrianos_beta_feedback_cohort_created_idx
on public.adrianos_beta_feedback (cohort, created_at desc);

alter table public.adrianos_beta_feedback enable row level security;

drop policy if exists "Families can create their own feedback" on public.adrianos_beta_feedback;
create policy "Families can create their own feedback"
on public.adrianos_beta_feedback
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Families can read their own feedback" on public.adrianos_beta_feedback;
create policy "Families can read their own feedback"
on public.adrianos_beta_feedback
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Families can delete their own feedback" on public.adrianos_beta_feedback;
create policy "Families can delete their own feedback"
on public.adrianos_beta_feedback
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, delete on public.adrianos_beta_feedback to authenticated;
