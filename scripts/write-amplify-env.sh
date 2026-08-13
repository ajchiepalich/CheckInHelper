#!/usr/bin/env bash
set -euo pipefail

# Amplify SSR runtimes read server env from .env.production at build time.
# Set these variables in Amplify Console → Environment variables.

required=(
  AUTH_SECRET
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  OPENAI_API_KEY
  OPENAI_VECTOR_STORE_ID
  ATLASSIAN_BASE_URL
  CRON_SECRET
)

export NODE_ENV="${NODE_ENV:-production}"
export LOCAL_MOCK_MODE="${LOCAL_MOCK_MODE:-false}"
export LOCAL_AUTH_ENABLED="${LOCAL_AUTH_ENABLED:-false}"

for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required Amplify environment variable: $key" >&2
    exit 1
  fi
done

: > .env.production

write_env() {
  local key="$1"
  local value="${!key}"
  printf '%s=%q\n' "$key" "$value" >> .env.production
}

if [[ -n "${APP_URL:-}" ]]; then
  write_env APP_URL
else
  echo "APP_URL is not set; Amplify will use the request host. Set it after configuring a custom domain." >&2
fi
write_env AUTH_SECRET
write_env SUPABASE_URL
write_env SUPABASE_SERVICE_ROLE_KEY
write_env OPENAI_API_KEY
write_env OPENAI_VECTOR_STORE_ID
write_env ATLASSIAN_BASE_URL
write_env CRON_SECRET

write_env NODE_ENV
write_env LOCAL_MOCK_MODE
write_env LOCAL_AUTH_ENABLED

if [[ -n "${OPENAI_MODEL:-}" ]]; then
  write_env OPENAI_MODEL
fi

if [[ -n "${ENTRA_CLIENT_ID:-}" ]]; then
  write_env ENTRA_CLIENT_ID
  write_env ENTRA_CLIENT_SECRET
  write_env ENTRA_TENANT_ID
fi

echo "Wrote .env.production for Amplify SSR runtime."
