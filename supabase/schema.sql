-- pixel-canvas online — shared Supabase project (Duckduckcare), everything
-- namespaced pixel_. Trust model: room-id-as-secret. Anyone who knows a room
-- id can read/write that row — accepted for casual invite-only rooms of ≤4
-- friends (same model as torklon #48). No auth; anonymous localStorage ids.

create table if not exists pixel_canvases (
  id text primary key,
  grid jsonb not null default '""'::jsonb, -- lib/grid serialize() string
  width int not null default 64,
  height int not null default 64,
  palette_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pixel_canvases enable row level security;

-- RLS: open by-id access (the id itself is the secret capability).
drop policy if exists pixel_canvases_select on pixel_canvases;
create policy pixel_canvases_select on pixel_canvases for select using (true);
drop policy if exists pixel_canvases_insert on pixel_canvases;
create policy pixel_canvases_insert on pixel_canvases for insert with check (true);
drop policy if exists pixel_canvases_update on pixel_canvases;
create policy pixel_canvases_update on pixel_canvases for update using (true);
-- no delete policy: clients cannot delete rows; retention is pg_cron's job

-- 30-day retention (PDPA-min): nightly cleanup of stale rooms.
create extension if not exists pg_cron;
select cron.schedule(
  'pixel_cleanup',
  '0 3 * * *',
  $$delete from pixel_canvases where updated_at < now() - interval '30 days'$$
);
