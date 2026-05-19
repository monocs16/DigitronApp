# Supabase migrations

This folder contains all database migrations for Digitron App (schema, RLS policies, triggers, and storage policies).

The `supabase/.temp/` directory is created by the Supabase CLI when you link a project (`supabase link`). It caches project ref, versions, and pooler URL on your machine. It is gitignored — do not commit it.

## Apply migrations (recommended)

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Link your remote project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
3. Push migrations:
   ```bash
   supabase db push
   ```

## Manual order

If you apply SQL by hand, run files in timestamp order:

1. `20260516231057_bdf6dd26-2dc2-498f-9236-57e9719e5a78.sql` — enums, tables, RLS, core functions
2. `20260516231116_d4053a35-bd8a-4799-8db7-6b7342ff31d9.sql` — function `search_path` hardening, grants
3. `20260517134255_b989e547-31ae-4116-bc6e-72e951ea5b90.sql` — auth trigger, storage policies for `order-photos`
