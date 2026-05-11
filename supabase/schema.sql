create table if not exists public.interviews (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  job_description text not null,
  resume_summary text,
  interview_plan text not null default '{}',
  status text not null default 'pending',
  conversation_history text not null default '[]',
  feedback text,
  overall_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_user_id_idx
  on public.interviews (user_id);

create index if not exists interviews_created_at_idx
  on public.interviews (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists interviews_set_updated_at on public.interviews;

create trigger interviews_set_updated_at
before update on public.interviews
for each row
execute function public.set_updated_at();

alter table public.interviews enable row level security;

create policy "Users can read their interviews"
on public.interviews
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their interviews"
on public.interviews
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their interviews"
on public.interviews
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
