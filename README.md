# Highlands Documentation Assistant

Production-ready internal AI documentation assistant for Church of the Highlands staff. The application retrieves answers from approved Confluence documentation using OpenAI File Search (Responses API + vector stores), cites original sources, and synchronizes documentation on a schedule.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- PostgreSQL + Prisma
- NextAuth with Microsoft Entra ID and local development auth
- OpenAI official Node SDK (Responses API, vector stores, file search)
- Atlassian Confluence Cloud REST API
- Vitest + Playwright

## Quick start

### Supabase (recommended)

1. Create a Supabase project and copy the **transaction pooler** and **direct** connection strings.
2. Configure `.env` (see [docs/supabase.md](./docs/supabase.md)).
3. Run:

```bash
cp .env.example .env
npm install
npm run db:migrate:deploy
npm run dev
```

### Local mock mode (no OpenAI or Confluence)

Set `LOCAL_MOCK_MODE=true` in `.env`. You still need a database (Supabase or Docker).

```bash
cp .env.example .env
docker compose up -d   # optional if using local Postgres instead of Supabase
npm install
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login) and sign in with:

- `staff@highlands.local` (staff role)
- `admin@highlands.local` (admin role)

## Scripts

| Command             | Purpose                                                 |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Start development server                                |
| `npm run build`     | Production build                                        |
| `npm run lint`      | ESLint                                                  |
| `npm run typecheck` | TypeScript                                              |
| `npm test`          | Vitest unit/integration tests                           |
| `npm run test:e2e`  | Playwright end-to-end tests                             |
| `npm run db:push`   | Apply Prisma schema                                     |
| `npm run db:seed`   | Seed local users and fixture sources                    |
| `npm run sync`      | CLI sync (`--dry-run`, `--source=ID`, `--retry-failed`) |

## Environment variables

See [`.env.example`](./.env.example). Required for production:

- `DATABASE_URL` — Supabase transaction pooler (or direct Postgres URL)
- `DIRECT_URL` — Supabase direct connection (Prisma migrations)
- `AUTH_SECRET`
- `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID`
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VECTOR_STORE_ID`
- `ATLASSIAN_BASE_URL`
- `CRON_SECRET`
- `APP_URL`

Set `LOCAL_AUTH_ENABLED=false` and `LOCAL_MOCK_MODE=false` in production.

## Configure Confluence

1. Ensure each approved page is **publicly accessible** in Confluence.
2. Set `ATLASSIAN_BASE_URL` to your Confluence Cloud site.
3. Admin → **Sources** → add the public page URL or page ID.
4. Run **Sync source** or **Run full sync**.

The app uses the public Confluence REST API without Atlassian credentials. If a page cannot be accessed anonymously, sync fails with a clear admin error.

## Configure OpenAI vector store

1. Create an OpenAI API key with access to the Responses API.
2. Create a vector store in the OpenAI dashboard or via API.
3. Set `OPENAI_API_KEY`, `OPENAI_VECTOR_STORE_ID`, and optionally `OPENAI_MODEL`.
4. Run a sync from the admin UI or `npm run sync`.

The sync pipeline uploads Markdown files, attaches them to the vector store, polls until indexing completes, then removes replaced files.

## Nightly synchronization

A protected endpoint is available at `GET /api/cron/sync` with header:

```http
Authorization: Bearer $CRON_SECRET
```

Vercel schedule example is in [`vercel.json`](./vercel.json). For other schedulers:

```bash
curl -X GET "$APP_URL/api/cron/sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Architecture

See [`docs/architecture.md`](./docs/architecture.md), [`docs/supabase.md`](./docs/supabase.md), [`docs/amplify.md`](./docs/amplify.md), [`docs/synchronization.md`](./docs/synchronization.md), and [`docs/security.md`](./docs/security.md).

## Routes

| Route             | Description          |
| ----------------- | -------------------- |
| `/chat`           | Staff chat           |
| `/history`        | Conversation history |
| `/admin`          | Admin dashboard      |
| `/admin/sources`  | Source management    |
| `/admin/sync`     | Sync runs            |
| `/admin/feedback` | Feedback review      |
| `/api/chat`       | Streaming chat API   |
| `/api/feedback`   | Feedback API         |
| `/api/admin/sync` | Manual sync          |
| `/api/cron/sync`  | Scheduled sync       |
| `/api/health`     | Health check         |

## Deployment (AWS Amplify + Supabase)

Production: **https://helper.highlands.io**

1. Connect the **`highlands`** GitHub repo in Amplify (branch `main`).
2. Add environment variables in Amplify Console (see [docs/amplify.md](./docs/amplify.md)).
3. Point custom domain **`helper.highlands.io`** at the Amplify app.
4. Deploy — `amplify.yml` runs Prisma migrations against Supabase during build.
5. Register Confluence sources and run sync (see [docs/amplify.md](./docs/amplify.md)).

Full walkthrough: [docs/amplify.md](./docs/amplify.md) and [docs/supabase.md](./docs/supabase.md).

## Deployment (Vercel, optional)

If deploying to Vercel instead:

## Remaining setup for production

- Microsoft Entra app registration and role assignment strategy
- Real Confluence service account and approved page list
- OpenAI vector store provisioning
- Production Supabase project and secret management
- Optional: enable parent/descendant and label-based source traversal

## License

Internal use for Church of the Highlands.
