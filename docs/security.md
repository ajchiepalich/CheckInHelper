# Security notes

## Secrets

All third-party credentials remain server-side. Never expose OpenAI, Atlassian, database, or auth secrets to the browser.

## Authentication and authorization

- Microsoft Entra ID for production staff authentication
- Local credentials only when `LOCAL_AUTH_ENABLED=true` (blocked in production)
- JWT sessions with role claims (`STAFF`, `ADMIN`)
- Middleware and server handlers enforce admin access

## Input and output safety

- Zod validation on API payloads and environment variables
- Chat input length limits and rate limiting
- Markdown rendered with `rehype-sanitize`
- Confluence HTML stripped of scripts/styles before conversion

## Prompt injection

Retrieved Confluence content is treated as untrusted data. The system prompt instructs the model to ignore document instructions that conflict with application rules.

## Cron protection

`/api/cron/sync` requires `Authorization: Bearer $CRON_SECRET`. Obscurity is not considered sufficient protection.

## Audit logging

Source create/update/delete/enable/disable and manual sync triggers write `AuditEvent` records.

## Logging

Structured logs avoid message content by default. Diagnostics endpoint exposes only non-secret capability flags.

## Atlassian access

Configured Confluence pages must be publicly accessible.

The application fetches content anonymously through the Confluence REST API. It does not use `ATLASSIAN_USER_EMAIL` or `ATLASSIAN_API_TOKEN`, and it will not attempt authenticated Atlassian access automatically.

If a configured page cannot be accessed anonymously, sync fails with a clear admin error.

## Production checklist

- Disable `LOCAL_AUTH_ENABLED` and `LOCAL_MOCK_MODE`
- Use strong `AUTH_SECRET` and `CRON_SECRET`
- Restrict admin role assignment in Entra ID
- Review Confluence page classification before enabling sources
- Rotate API tokens on a regular schedule
