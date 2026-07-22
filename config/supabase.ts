import { createClient } from "@supabase/supabase-js";

// Shared Supabase project (Duckduckcare) with torklon (#48) + makruk (#21) —
// everything pixel-related is namespaced `pixel_` / `pixel:`.
// URL + anon key are public-safe by design: access control is the RLS
// room-id-as-secret gate on `pixel_canvases`, never this key.
const SUPABASE_URL = "https://zmhxqacxmtnwfbpskujz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptaHhxYWN4bXRud2ZicHNrdWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTY4NzQsImV4cCI6MjA5NzA5Mjg3NH0.EFy9dLOTcESZKZam-20gY3B82gV7cZvrTjOVZi86VLU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
