# Supabase database setup

The app uses PostgreSQL via Prisma. Supabase is the recommended hosted database for local development, Amplify production, and cron jobs.

## Production project

| Field | Value |
| ----- | ----- |
| Project | **Check In Helper** |
| Reference ID | `vsuhzudjyclfaojwrhrd` |
| Region | Canada (Central) |
| Dashboard | [supabase.com/dashboard/project/vsuhzudjyclfaojwrhrd](https://supabase.com/dashboard/project/vsuhzudjyclfaojwrhrd/) |

Schema is managed with **Prisma** (`prisma/migrations/`). Do not enable Supabase GitHub SQL migrations for this app.

## 1. Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com).
2. Create a new project and choose a region close to your users (and Vercel deployment region).
3. Save the database password shown during setup.

## 2. Copy connection strings

In **Project Settings → Database**, copy both URLs:

| Variable | Supabase setting | Used for |
| -------- | ---------------- | -------- |
| `DATABASE_URL` | **Transaction pooler** (port `6543`) | App runtime (Vercel, local dev) |
| `DIRECT_URL` | **Session pooler** (port `5432`) | Prisma migrations only |

Add `?pgbouncer=true` to the transaction pooler URL if it is not already present.

Example (Check In Helper project, `ca-central-1`):

```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-ca-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-ca-central-1.pooler.supabase.com:5432/postgres
```

Replace `[project-ref]` and `[password]` with your project values.

**IPv4 note:** If the hostname `db.[project-ref].supabase.co` does not resolve on your network, use the **pooler host** for both URLs (as above). The Supabase CLI and Prisma migrations work with the session pooler on port `5432`.

## 3. Configure local `.env`

```bash
cp .env.example .env
```

Paste your Supabase `DATABASE_URL` and `DIRECT_URL` into `.env`.

You do **not** need Docker Postgres when using Supabase.

## 4. Apply the schema

```bash
npm run db:migrate:deploy
```

Optional local seed (dev users and fixture sources):

```bash
npm run db:seed
```

## 5. Verify

```bash
npm run dev
```

Open `/api/health` — status should be `ok`.

Browse data in the [Supabase Table Editor](https://supabase.com/dashboard/project/vsuhzudjyclfaojwrhrd/editor) or run:

```bash
npm run db:studio
```

## 6. Amplify production

Set the same two variables in **Amplify → Environment variables** (see [amplify.md](./amplify.md)):

- `DATABASE_URL` → transaction pooler URL
- `DIRECT_URL` → direct URL (used during build/migrate steps)

After the first deploy, run migrations against production:

```bash
DATABASE_URL="..." DIRECT_URL="..." npm run db:migrate:deploy
```

Or use the Supabase SQL editor to confirm tables exist after migrate.

## Optional: local Docker Postgres

`docker-compose.yml` remains available if you want a fully offline database:

```bash
docker compose up -d
```

Use the same value for both `DATABASE_URL` and `DIRECT_URL`:

```env
DATABASE_URL=postgresql://highlands:highlands_dev@localhost:5432/highlands_docs
DIRECT_URL=postgresql://highlands:highlands_dev@localhost:5432/highlands_docs
```

## Migrating existing local data

If you already have conversations or sources in local Docker Postgres:

```bash
docker exec highlands-docs-postgres pg_dump -U highlands highlands_docs > backup.sql
```

Import into Supabase via the SQL editor or `psql` with your `DIRECT_URL`.
