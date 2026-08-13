# Supabase database setup

The app uses Supabase PostgreSQL directly through `@supabase/supabase-js`.

## Production project

| Field | Value |
| ----- | ----- |
| Project | **Check In Helper** |
| Reference ID | `vsuhzudjyclfaojwrhrd` |
| Region | Canada (Central) |
| Dashboard | [supabase.com/dashboard/project/vsuhzudjyclfaojwrhrd](https://supabase.com/dashboard/project/vsuhzudjyclfaojwrhrd/) |

Schema changes are managed as SQL in [supabase/migrations](../supabase/migrations). Apply them using the Supabase CLI or SQL Editor before deployment.

## 1. Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com).
2. Create a new project and choose a region close to your users (and Vercel deployment region).
3. Save the database password shown during setup.

## 2. Copy API credentials

In **Project Settings → Database**, copy both URLs:

| Variable | Supabase setting | Used for |
| -------- | ---------------- | -------- |
| `SUPABASE_URL` | **Project URL** | Server runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | **service_role key** | Server-only database access |

Example:

```env
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
```

Replace the placeholders with values from **Project Settings → API**. Do not expose the service-role key in browser code.

## 3. Configure local `.env`

```bash
cp .env.example .env
```

Paste the Supabase values into `.env`.

## 4. Apply the schema

Apply [the direct-client migration](../supabase/migrations/20260813190000_direct_supabase_client.sql) in the Supabase SQL Editor. It adds generated IDs, timestamp triggers, missing application columns, and RLS protection to the existing schema.

## 5. Verify

```bash
npm run dev
```

Open `/api/health` — status should be `ok`.

Browse data in the [Supabase Table Editor](https://supabase.com/dashboard/project/vsuhzudjyclfaojwrhrd/editor).

## 6. Amplify production

Set these variables in **Amplify → Environment variables** (see [amplify.md](./amplify.md)):

- `SUPABASE_URL` → project URL
- `SUPABASE_SERVICE_ROLE_KEY` → service-role key

## Applying future migrations

Create a timestamped SQL file in [supabase/migrations](../supabase/migrations), review it, and apply it with `supabase db push` or the Supabase SQL Editor.
