-- Hosted Supabase grants table privileges to `anon` / `authenticated` by default,
-- so RLS (which only filters rows AFTER base privileges exist) is enough there.
-- A local `supabase db reset` applying only these migrations does NOT issue those
-- grants for objects created via SQL, so every authenticated query returns
-- 42501 "permission denied for table ...". Grant the standard privileges here so
-- local/CI behaves like hosted; RLS policies still gate which rows are visible.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
