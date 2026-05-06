-- Migration 002 : refonte invités → table people + wedding_guests
--
-- Nouvelle architecture :
--   people        : données de la personne (partagées entre mariages)
--   wedding_guests : participation par mariage (RSVP, table, menu…)
--
-- La migration déduplique les invités en prioritisant les données Bordeaux.
-- L'ancienne table guests est renommée guests_backup (supprimable manuellement).

-- ─── 1. Table people ────────────────────────────────────────────────────────
create table public.people (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  email       text,
  phone       text,
  group_name  text,
  children    jsonb not null default '[]',
  notes       text,
  created_at  timestamptz default now()
);

alter table public.people enable row level security;
create policy "allow all" on public.people for all using (true) with check (true);

-- ─── 2. Table wedding_guests ─────────────────────────────────────────────────
create table public.wedding_guests (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid references public.weddings(id)  on delete cascade not null,
  person_id     uuid references public.people(id)    on delete cascade not null,
  rsvp_status   text not null default 'pending'
                  check (rsvp_status in ('pending', 'confirmed', 'declined')),
  table_number  int,
  menu_choice   text,
  plus_one      boolean not null default false,
  plus_one_name text,
  created_at    timestamptz default now(),
  unique (wedding_id, person_id)
);

alter table public.wedding_guests enable row level security;
create policy "allow all" on public.wedding_guests for all using (true) with check (true);

-- ─── 3. Migration des données ────────────────────────────────────────────────
-- Seulement si l'ancienne table guests existe et contient des données.

do $$
declare
  has_children boolean;
  bdx_id       uuid;
begin
  -- Vérifier que la table guests existe
  if not exists (select from information_schema.tables where table_name = 'guests' and table_schema = 'public') then
    raise notice 'Table guests introuvable – migration des données ignorée.';
    return;
  end if;

  -- Vérifier si la colonne children existe dans guests
  select exists (
    select from information_schema.columns
    where table_schema = 'public' and table_name = 'guests' and column_name = 'children'
  ) into has_children;

  -- Trouver le mariage de Bordeaux (civil) pour prioriser ses données
  select id into bdx_id
  from public.weddings
  where lower(name) like '%bordeaux%' or lower(name) like '%civil%'
  limit 1;

  -- 3a. Insérer les personnes uniques (dédupliqué par prénom+nom, Bordeaux en priorité)
  if has_children then
    execute $q$
      insert into public.people (first_name, last_name, email, phone, group_name, children, notes, created_at)
      select first_name, last_name, email, phone, group_name,
             coalesce(children, '[]'::jsonb),
             notes, created_at
      from (
        select *,
               row_number() over (
                 partition by lower(trim(first_name)), lower(trim(last_name))
                 order by
                   case when wedding_id = $1 then 0 else 1 end,
                   created_at
               ) as rn
        from public.guests
      ) ranked
      where rn = 1
    $q$ using bdx_id;
  else
    execute $q$
      insert into public.people (first_name, last_name, email, phone, group_name, children, notes, created_at)
      select first_name, last_name, email, phone, group_name,
             '[]'::jsonb,
             notes, created_at
      from (
        select *,
               row_number() over (
                 partition by lower(trim(first_name)), lower(trim(last_name))
                 order by
                   case when wedding_id = $1 then 0 else 1 end,
                   created_at
               ) as rn
        from public.guests
      ) ranked
      where rn = 1
    $q$ using bdx_id;
  end if;

  -- 3b. Insérer les wedding_guests (une ligne par (mariage, personne))
  insert into public.wedding_guests (wedding_id, person_id, rsvp_status, table_number, menu_choice, plus_one, plus_one_name)
  select distinct on (g.wedding_id, lower(trim(g.first_name)), lower(trim(g.last_name)))
    g.wedding_id,
    p.id,
    g.rsvp_status,
    g.table_number,
    g.menu_choice,
    g.plus_one,
    g.plus_one_name
  from public.guests g
  join public.people p
    on lower(trim(p.first_name)) = lower(trim(g.first_name))
   and lower(trim(p.last_name))  = lower(trim(g.last_name))
  order by g.wedding_id, lower(trim(g.first_name)), lower(trim(g.last_name)), g.created_at;

  raise notice 'Migration terminée.';
end $$;

-- ─── 4. Archiver l'ancienne table ────────────────────────────────────────────
-- Renommer guests en guests_backup (supprimer manuellement quand tout est validé)
do $$
begin
  if exists (select from information_schema.tables where table_name = 'guests' and table_schema = 'public') then
    alter table public.guests rename to guests_backup;
    raise notice 'Table guests renommée en guests_backup.';
  end if;
end $$;
