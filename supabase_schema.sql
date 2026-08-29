-- Run this once in Supabase Dashboard → SQL Editor → New Query → Run

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  total_saved numeric default 0 not null,
  created_at timestamptz default now() not null
);

create table public.savings_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  amount numeric not null,
  url text,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;
alter table public.savings_events enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "read own savings events" on public.savings_events
  for select using (auth.uid() = user_id);

create policy "insert own savings events" on public.savings_events
  for insert with check (auth.uid() = user_id);

-- Auto-create a profile row the moment someone signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Atomic increment, avoids read-then-write race conditions from the extension
create function public.increment_total_saved(uid uuid, amt numeric)
returns void as $$
begin
  update public.profiles set total_saved = total_saved + amt where id = uid;
end;
$$ language plpgsql security definer;

grant execute on function public.increment_total_saved(uuid, numeric) to authenticated;

-- Expose to Data API (Table Editor → toggle "Expose via API" if not automatic)
