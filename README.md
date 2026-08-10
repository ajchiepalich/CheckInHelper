# Highlands Documentation Assistant

Production-ready internal AI documentation assistant for Church of the Highlands staff. The application retrieves answers from approved Confluence documentation using OpenAI File Search (Responses API + vector stores), cites original sources, and synchronizes documentation on a schedule.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- PostgreSQL + Prisma
- NextAuth with Microsoft Entra ID and local development auth
- OpenAI official Node SDK (Responses API, vector stores, file search)
- Atlassian Confluence Cloud REST API
- Vitest + Playwright

## Quick start (local mock mode)

Local mock mode runs without OpenAI or Confluence credentials.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:push
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

- `DATABASE_URL`
- `AUTH_SECRET`
- `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID`
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VECTOR_STORE_ID`
- `ATLASSIAN_BASE_URL`, `ATLASSIAN_USER_EMAIL`, `ATLASSIAN_API_TOKEN`
- `CRON_SECRET`
- `APP_URL`

Set `LOCAL_AUTH_ENABLED=false` and `LOCAL_MOCK_MODE=false` in production.

## Configure Confluence

1. Create an Atlassian API token for a service account with read access to approved spaces.
2. Set `ATLASSIAN_BASE_URL`, `ATLASSIAN_USER_EMAIL`, and `ATLASSIAN_API_TOKEN`.
3. Sign in as an admin and open **Admin → Sources**.
4. Add explicit Confluence page URLs or page IDs. Parent/descendant and label modes are modeled but only explicit pages sync in v1.
5. Run **Sync source** or **Run full sync**.

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

See [`docs/architecture.md`](./docs/architecture.md), [`docs/synchronization.md`](./docs/synchronization.md), and [`docs/security.md`](./docs/security.md).

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

## Deployment (Vercel)

1. Provision PostgreSQL (Neon, Supabase, RDS, etc.).
2. Configure environment variables in Vercel.
3. Deploy the app and run `npm run db:migrate:deploy`.
4. Configure Entra redirect URI: `https://your-app.example.com/api/auth/callback/microsoft-entra-id`.
5. Configure nightly cron with `CRON_SECRET`.

## Remaining setup for production

- Microsoft Entra app registration and role assignment strategy
- Real Confluence service account and approved page list
- OpenAI vector store provisioning
- Production PostgreSQL and secret management
- Optional: enable parent/descendant and label-based source traversal

## License

Internal use for Church of the Highlands.
