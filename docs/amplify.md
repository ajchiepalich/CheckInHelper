# AWS Amplify deployment

Deploy the app to **AWS Amplify Hosting** with **Supabase** as the database backend.

Production URL: **https://helper.highlands.io**

## 1. Connect the repository

1. In [AWS Amplify Console](https://console.aws.amazon.com/amplify/), choose **Create new app → Host web app**.
2. Connect GitHub and select the **`highlands`** organization repository for this project.
3. Branch: **`main`**.
4. Amplify should auto-detect **Next.js SSR**. The repo includes `amplify.yml` for environment wiring.

## 2. Add environment variables

In **Amplify → App settings → Environment variables**, add every variable below for the **production** branch.

| Variable | Value |
| -------- | ----- |
| `APP_URL` | `https://helper.highlands.io` (optional until the custom domain is configured) |
| `NODE_ENV` | `production` |
| `LOCAL_MOCK_MODE` | `false` |
| `LOCAL_AUTH_ENABLED` | `false` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server-side service-role key |
| `AUTH_SECRET` | Random string, at least 32 characters |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `OPENAI_VECTOR_STORE_ID` | Your vector store ID |
| `OPENAI_MODEL` | `gpt-4.1-mini` (optional) |
| `ATLASSIAN_BASE_URL` | `https://churchofthehighlands.atlassian.net/` |
| `CRON_SECRET` | Random secret for `/api/cron/sync` |

Get Supabase URLs from [Check In Helper → Project Settings → Database](https://supabase.com/dashboard/project/vsuhzudjyclfaojwrhrd/settings/database). See [supabase.md](./supabase.md) for the pooler-host pattern if `db.*.supabase.co` does not resolve on your network.

### Optional: Microsoft Entra ID

If you enable real login later, also add:

- `ENTRA_CLIENT_ID`
- `ENTRA_CLIENT_SECRET`
- `ENTRA_TENANT_ID`

Register redirect URI: `https://helper.highlands.io/api/auth/callback/microsoft-entra-id`

## 3. Custom domain

1. Amplify → **Hosting → Custom domains**.
2. Add **`helper.highlands.io`**.
3. Create the DNS records Amplify shows (usually a CNAME to Amplify).
4. Wait for SSL provisioning, then confirm `APP_URL` matches the live domain.

## 4. First deploy

On push to `main`, Amplify runs:

1. `npm ci`
2. Writes server env to `.env.production`
3. `npm run build`

After deploy, verify:

```bash
curl https://helper.highlands.io/api/health
```

Expected: `"status":"ok"`.

## 5. Register and sync documentation

The production Supabase database starts empty of real sources. From your machine (with production env vars or a local `.env` pointed at the same Supabase project):

```bash
npm run sources:bootstrap
npm run sync
```

Approved source URLs live in [`config/knowledge-sources.ts`](../config/knowledge-sources.ts). Add new pages there, then run the commands above from a machine with Playwright browsers installed (`npx playwright install chromium`).

Or use **Admin → Sources** in the deployed app after it is live.

### Sync on Amplify (important)

External Confluence pages are fetched with **Playwright/Chromium** during sync. Amplify serverless functions may not run Playwright reliably. For production sync, prefer:

- Running `npm run sync` locally against production Supabase + OpenAI, or
- Triggering sync from Admin and watching logs for timeout/browser errors

## 6. Nightly sync (EventBridge Scheduler)

Amplify does not run `vercel.json` crons. Schedule a nightly job in **AWS EventBridge Scheduler** that calls the app’s sync endpoint.

### Endpoint

| Setting | Value |
| -------- | ----- |
| **URL** | `https://helper.highlands.io/api/cron/sync` |
| **Method** | `GET` (or `POST`) |
| **Header** | `Authorization: Bearer <CRON_SECRET>` |
| **Schedule** | `cron(0 3 * * ? *)` — daily at **03:00 UTC** |
| **Timezone** | UTC |

Use the same `CRON_SECRET` value set in Amplify environment variables.

### AWS Console steps

1. Open **Amazon EventBridge → Schedules → Create schedule**.
2. **Schedule name:** `checkinhelper-nightly-sync`
3. **Schedule pattern:** Recurring schedule → Cron-based → `0 3 * * ? *` (03:00 UTC daily).
4. **Flexible time window:** Off (run at exact time).
5. **Target:** Choose one:
   - **Option A (simplest):** Lambda that `curl`s the endpoint with the Bearer header, or
   - **Option B:** EventBridge **API destination** → HTTPS POST/GET to the URL above with `Authorization` header.
6. **Retry policy:** 2 retries, max event age 1 hour (recommended).
7. Save and **Run now** once to test.

### Manual test (before or after schedule)

```bash
curl -X GET "https://helper.highlands.io/api/cron/sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: JSON with `status: "COMPLETED"` and sync counts. Confirm in the app at **Admin → Sync**.

### Sync on Amplify (important)

External Confluence pages use **Playwright/Chromium** during sync. If the scheduled job fails in Amplify logs (timeout/browser error), run sync from a machine with the repo instead:

```bash
npm run sync
```

Point local `.env` at production Supabase + OpenAI, or trigger **Admin → Run full sync** and monitor logs.

## 7. Apply Supabase migrations before deployment

Apply reviewed SQL files from [supabase/migrations](../supabase/migrations) with the Supabase CLI or SQL Editor. Amplify does not apply database migrations during application builds.

## Troubleshooting

| Issue | Fix |
| ----- | --- |
| Build fails on env validation | Confirm all required Amplify env vars are set (see section 2). |
| App cannot access data | Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured in Amplify. |
| App loads but APIs fail | Confirm `.env.production` vars were written — redeploy after fixing Amplify env vars. |
| Sync fails in production | Run sync locally; see Playwright note in section 5. |
