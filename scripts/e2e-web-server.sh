#!/usr/bin/env bash
set -euo pipefail

# Playwright starts webServer before globalSetup. Ensure Supabase exists and
# export its credentials before Vite reads the e2e environment.
if ! supabase status -o env >/dev/null 2>&1; then
  echo "[e2e] Starting local Supabase before the Vite server…"
  supabase start
fi

eval "$(supabase status -o env)"

: "${API_URL:?supabase status did not return API_URL}"
: "${SERVICE_ROLE_KEY:?supabase status did not return SERVICE_ROLE_KEY}"

# Supabase CLI 2.109 may omit ANON_KEY from `status -o env`; the local stack's
# stable public test key is also validated in e2e/global-setup.ts.
LOCAL_ANON_KEY="${ANON_KEY:-${PUBLISHABLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}}"

export VITE_SUPABASE_URL="$API_URL"
export VITE_SUPABASE_PUBLISHABLE_KEY="$LOCAL_ANON_KEY"
export SUPABASE_URL="$API_URL"
export SUPABASE_PUBLISHABLE_KEY="$LOCAL_ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

exec pnpm exec vite --mode e2e --port 5183 --strictPort
