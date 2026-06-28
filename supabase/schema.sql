-- ============================================================
--  Fantasy F1 2026 — esquema para modo COMPARTIDO (Supabase)
--  Pega y ejecuta todo esto en  Supabase > SQL Editor.
--  Guarda solo los CAMBIOS nuevos; la historia 2026 ya viaja
--  embebida en data.js, igual para todos.
-- ============================================================

create table if not exists picks (
  race    text not null,
  player  text not null,
  drivers jsonb not null default '[]',
  updated_at timestamptz default now(),
  primary key (race, player)
);

create table if not exists results (
  race   text not null,
  driver text not null,
  data   jsonb not null default '{}',
  primary key (race, driver)
);

create table if not exists race_meta (
  race text primary key,
  data jsonb not null default '{}'
);

create table if not exists payments (
  player text primary key,
  data   jsonb not null default '{}'
);

-- Realtime: que la app reciba cambios al instante
alter publication supabase_realtime add table picks, results, race_meta, payments;

-- ------------------------------------------------------------
--  Seguridad. Liga de amigos: acceso abierto con la anon key.
--  (Si luego quieres login real, cambia estas políticas.)
-- ------------------------------------------------------------
alter table picks     enable row level security;
alter table results   enable row level security;
alter table race_meta enable row level security;
alter table payments  enable row level security;

create policy "open picks"   on picks     for all using (true) with check (true);
create policy "open results" on results   for all using (true) with check (true);
create policy "open meta"    on race_meta for all using (true) with check (true);
create policy "open pay"     on payments  for all using (true) with check (true);
