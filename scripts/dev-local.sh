#!/usr/bin/env bash
# Run the app in development against the LOCAL Supabase stack, with a
# ready-to-use super-admin seeded. Safe sandbox — never touches the remote
# project configured in .env (shell env vars override .env files in Vite).
set -euo pipefail
cd "$(dirname "$0")/.."

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@digitron.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-digitron123}"
ADMIN_NAME="${ADMIN_NAME:-Admin Digitron}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "✗ supabase CLI not found. Install it: https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

# 1. Ensure the local stack is running.
if supabase status >/dev/null 2>&1; then
  echo "▶ Local Supabase already running."
else
  echo "▶ Starting local Supabase…"
  supabase start
fi

# 2. Apply any pending migrations (no-op if already up to date).
echo "▶ Applying migrations…"
supabase migration up >/dev/null 2>&1 || true

# 3. Load local credentials from the running stack.
eval "$(supabase status -o env)"   # sets API_URL, ANON_KEY, SERVICE_ROLE_KEY, …

# 4. Seed/ensure the super admin.
echo "▶ Seeding super admin…"
API_URL="$API_URL" SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" ADMIN_NAME="$ADMIN_NAME" \
  node scripts/seed-admin.mjs

# 5. Run Vite against local (shell env has highest priority in Vite).
export VITE_SUPABASE_URL="$API_URL"
export VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export SUPABASE_URL="$API_URL"
export SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
export CF_WORKERS=0

echo ""
echo "  Digitron (local) ───────────────────────────────"
echo "  App      → http://localhost:5173/"
echo "  Studio   → http://127.0.0.1:54323"
echo "  Login    → $ADMIN_EMAIL / $ADMIN_PASSWORD"
echo "  Supabase → $API_URL"
echo "  ─────────────────────────────────────────────────"
echo ""

exec bun --bun vite dev
