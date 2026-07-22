# Supabase setup (shared project)

Shared free project **Duckduckcare** with torklon (#48) + makruk (#21) —
pixel objects are namespaced: table `pixel_canvases`, channel `pixel:<roomId>`,
cron job `pixel_cleanup`. Creds live in workspace `.secret/env.local`
(`SUPABASE_SHARED_URL` / `SUPABASE_SHARED_ANON_KEY`); the anon key is
public-safe and hardcoded in `config/supabase.ts`.

1. Apply `supabase/schema.sql` (SQL editor or MCP `apply_migration`).
2. Realtime broadcast + presence need no server config (client channels only).
3. Verify pg_cron is available on the free tier: `select * from cron.job;`
   should list `pixel_cleanup`. If pg_cron is unavailable, fall back to a
   GitHub Actions nightly cron hitting a cleanup SQL via the connection string.
4. Retention: rooms idle > 30 days are deleted nightly at 03:00 UTC.
