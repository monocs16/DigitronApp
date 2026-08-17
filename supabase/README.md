# Supabase database and migrations

This directory is the source of truth for Digitron's Postgres schema, RLS policies, triggers, grants, indexes, and private Storage configuration.

Migration filenames are ordered timestamps. Never rewrite a migration that has already been applied to a shared environment; create a new one with the installed CLI:

```bash
pnpm exec supabase migration new descriptive_name
```

`supabase/config.toml` contains a project-ref placeholder and custom local ports. `supabase link` stores the real remote reference and connection metadata in `supabase/.temp/`. That directory is gitignored and must never be committed.

## Prerequisites

- Install project dependencies with `pnpm install`; the repository includes the Supabase CLI package and the lockfile pins the resolved version.
- Run Docker for the local stack.
- Authenticate before linking a remote project.

Use `pnpm exec supabase ...` in this repository so commands run with the installed CLI version.

## Local workflow

For normal application development:

```bash
pnpm run dev:local
```

This starts the local stack if needed, applies pending migrations without deleting existing data, ensures the local superuser, and starts Vite. To rebuild the database from every migration:

```bash
pnpm run dev:local:fresh
```

`dev:local:fresh` is destructive to local data.

For a schema change:

```bash
pnpm exec supabase migration new descriptive_name
# Edit the generated SQL file.
pnpm exec supabase migration up --local
pnpm exec supabase db advisors --local --type all
pnpm exec supabase gen types --local > src/integrations/supabase/types.ts
pnpm exec supabase migration list --local
```

Then verify the affected query or workflow against the migrated local database. Use `pnpm run supabase:reset` before completion when the change must also work from a fresh database.

## Remote workflow

Link and inspect the intended project:

```bash
pnpm exec supabase link --project-ref YOUR_PROJECT_REF
pnpm exec supabase migration list --linked
pnpm exec supabase db push --linked --dry-run
```

Review the exact pending files and target before applying them:

```bash
pnpm exec supabase db push --linked
pnpm exec supabase migration list --linked
```

GitHub CD does **not** run `supabase db push`. Apply and verify a required remote migration before deploying code that selects its new table, column, enum value, function, or view.

For destructive changes, enum changes, data backfills, or trigger rewrites, take a recoverable backup and schedule an appropriate maintenance window before pushing.

## Data API grants and RLS

Supabase Data API access has two independent layers:

1. Postgres grants determine whether `anon`, `authenticated`, or `service_role` can reach an object.
2. RLS policies determine which rows an allowed role can read or change.

New Supabase projects no longer guarantee automatic Data API exposure for new `public` tables. Every new operational table must therefore include deliberate grants, RLS enablement, and least-privilege policies in its migration. Do not grant `anon` access unless a public product flow requires it. See Supabase's [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

This repository establishes explicit privileges and default privileges in:

- `20260620100000_service_role_grants.sql`
- `20260621000000_authenticated_grants.sql`

Review those defaults and the table's RLS policies rather than assuming either layer is sufficient by itself.

### Technician inventory read models

`parts_technician` and `order_parts_technician` are physical `public` tables protected by RLS, not views. Migration `20260808054134_secure_technician_read_models.sql` preserved the former Data API relation names while removing view-owner permission semantics. Authenticated access is constrained by their explicit policies, and the projections contain no stock, unit cost, supplier, or order-part commercial snapshots.

Functions in the non-exposed `private` schema synchronize these tables transactionally from `parts` and `order_parts`. Their `search_path` is fixed and direct `EXECUTE` is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`. Application code must write the commercial source tables and treat the read models as projections.

Migration `20260808063014_extend_parts_catalog.sql` adds nullable `location`, `datasheet`, `nte_substitute`, and `image` columns to `parts` and mirrors those technician-safe fields into `parts_technician`. Any future safe-field change must update the source table, projection, trigger column list, generated TypeScript types, grants/RLS verification, and both admin and technician queries as one unit.

## Current migration inventory

The files on disk and `supabase migration list` are authoritative. The current sequence is:

| Migration                                                    | Purpose                                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `20260614010001_core_schema.sql`                             | Core enums, tables, helpers, triggers, and RLS enablement.                              |
| `20260614010002_audit.sql`                                   | Generic technical audit log and operational audit triggers.                             |
| `20260614010003_rls.sql`                                     | Role and assignment-based RLS policies.                                                 |
| `20260614010004_storage_indexes.sql`                         | Private `order-photos` bucket, Storage policies, and indexes.                           |
| `20260614120000_flow_notifications.sql`                      | Decision and pickup-notification timestamps.                                            |
| `20260620100000_service_role_grants.sql`                     | Explicit server-only service-role privileges.                                           |
| `20260621000000_authenticated_grants.sql`                    | Explicit authenticated Data API privileges and defaults.                                |
| `20260712000000_service_order_integrity_and_privacy.sql`     | Independent equipment, visit-owned accessories, inventory privacy, and integrity rules. |
| `20260712000001_customer_search_indexes.sql`                 | Trigram indexes for customer lookup.                                                    |
| `20260713000000_budget_and_payment_guards.sql`               | One budget per order, quoted-part synchronization, and payment overcollection guards.   |
| `20260718000000_legacy_numeric_order_numbers.sql`            | Concurrency-safe numbering after legacy order `47719`.                                  |
| `20260719000000_order_equipment_condition.sql`               | Per-visit equipment condition used by the service-order PDF.                            |
| `20260721001017_rename_delivered_to_awaiting_withdrawal.sql` | Renames the obsolete `delivered` stage to `awaiting_withdrawal`.                        |
| `20260721004030_extend_order_audit_history.sql`              | Links child audit entries to their order and includes photo history.                    |
| `20260721010944_allow_part_creation_during_evaluation.sql`   | Allows assigned technicians to propose non-commercial parts during evaluation.          |
| `20260721021428_guard_used_part_inventory.sql`               | Requires a quoted part and sufficient stock before repair consumption.                  |
| `20260721032000_preserve_budget_when_using_parts.sql`        | Limits budget recalculation to quoted lines and repairs historically affected budgets.  |
| `20260723000631_add_equipment_description.sql`               | Adds nullable `equipment.description` for forms, inventory, and search.                 |
| `20260808054134_secure_technician_read_models.sql`           | Replaces privileged technician views with synchronized RLS read-model tables.           |
| `20260808063014_extend_parts_catalog.sql`                    | Adds location, datasheet, NTE substitute, and image metadata to the parts catalog.      |
| `20260817032010_add_orders_list_read_model.sql`              | Adds the RLS-preserving order-list read model and search indexes for paginated lists.   |

If SQL must be inspected manually, obtain the real order instead of copying an old list:

```bash
rg --files supabase/migrations | sort
```

## Schema-cache troubleshooting

An error such as:

```text
Could not find the 'description' column of 'equipment' in the schema cache
```

usually means the application code reached a project where `20260723000631_add_equipment_description.sql` was not applied. It does not mean the table has no rows.

For the parts module, the equivalent missing-column error usually means `20260808063014_extend_parts_catalog.sql` is absent, while a missing `parts_technician` relation or unexpected view behavior indicates that `20260808054134_secure_technician_read_models.sql` has not been applied.

1. Compare `pnpm exec supabase migration list --local` and `--linked`.
2. Run `pnpm exec supabase db push --linked --dry-run`.
3. Apply the missing migration to the verified project.
4. Confirm the Data API grant/RLS policy when the missing object is a new table.
5. Re-run the exact repository query and regenerate types if necessary.

Do not mask a schema or permission failure by converting the query result to an empty array.

## Historical production import

`scripts/import-production-orders.mjs` is privileged data tooling, not a migration. Its default mode is a dry-run. `--execute` uses the service role and replaces operational data while preserving Auth profiles and roles.

Never run it as part of `db push`, local bootstrap, CI, or CD. Follow the backup, target-verification, and maintenance-window procedure in [`ENGINEERING.md`](../ENGINEERING.md#importación-histórica-de-producción).
