-- Schema pour l'app mariage
-- À exécuter dans l'éditeur SQL de Supabase

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date,
  location text not null,
  type text not null check (type in ('civil', 'religious')),
  created_at timestamptz default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references public.weddings(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending', 'confirmed', 'declined')),
  table_number int,
  menu_choice text,
  plus_one boolean not null default false,
  plus_one_name text,
  notes text,
  created_at timestamptz default now()
);

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references public.weddings(id) on delete cascade not null,
  name text not null,
  color text not null default '#f43f5e',
  created_at timestamptz default now()
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references public.weddings(id) on delete cascade not null,
  category_id uuid references public.budget_categories(id) on delete set null,
  name text not null,
  estimated numeric not null default 0,
  actual numeric not null default 0,
  paid boolean not null default false,
  notes text,
  created_at timestamptz default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references public.weddings(id) on delete cascade not null,
  title text not null,
  done boolean not null default false,
  due_date date,
  assigned_to text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at timestamptz default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references public.weddings(id) on delete cascade not null,
  category text not null,
  name text not null,
  contact_name text,
  email text,
  phone text,
  price numeric,
  deposit_paid boolean not null default false,
  deposit_amount numeric,
  contract_signed boolean not null default false,
  notes text,
  created_at timestamptz default now()
);

-- RLS (Row Level Security) - désactiver si vous ne gérez pas d'auth
alter table public.weddings enable row level security;
alter table public.guests enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_items enable row level security;
alter table public.tasks enable row level security;
alter table public.vendors enable row level security;

-- Policies ouvertes (pour commencer sans auth)
-- À remplacer par des policies basées sur auth.uid() quand vous ajoutez l'authentification
create policy "allow all" on public.weddings for all using (true) with check (true);
create policy "allow all" on public.guests for all using (true) with check (true);
create policy "allow all" on public.budget_categories for all using (true) with check (true);
create policy "allow all" on public.budget_items for all using (true) with check (true);
create policy "allow all" on public.tasks for all using (true) with check (true);
create policy "allow all" on public.vendors for all using (true) with check (true);
