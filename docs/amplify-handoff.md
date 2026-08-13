# Amplify handoff punch list

Hand this to whoever is deploying **CheckInHelper** to AWS Amplify with Supabase.

| Item | Value |
| ---- | ----- |
| Production URL | `https://helper.highlands.io` |
| GitHub org | `highlands` |
| Branch | `main` |
| Supabase project | [Check In Helper](https://supabase.com/dashboard/project/vsuhzudjyclfaojwrhrd/) (`vsuhzudjyclfaojwrhrd`) |
| Build spec | `amplify.yml` (in repo root) |

---

## Phase 1 — Amplify app

- [ ] AWS Amplify Console → **Create new app → Host web app**
- [ ] Connect GitHub → select **`highlands/<repo-name>`** (confirm exact repo name with team)
- [ ] Branch: **`main`**
- [ ] Confirm framework: **Next.js SSR** (auto-detected)
- [ ] Confirm build uses repo **`amplify.yml`** (do not override unless debugging)
- [ ] Node.js: use Amplify default (**Amazon Linux 2023**, Node 20+)

---

## Phase 2 — Environment variables

Add in **Amplify → App settings → Environment variables** (production branch).

### Required

| Variable | Value | Notes |
| -------- | ----- | ----- |
| `APP_URL` | `https://helper.highlands.io` | Optional until the custom domain is configured; then it must match the live domain |
| `NODE_ENV` | `production` | |
| `LOCAL_MOCK_MODE` | `false` | Required in prod |
| `LOCAL_AUTH_ENABLED` | `false` | Required in prod |
| `SUPABASE_URL` | *(from Supabase)* | Project URL from **Project Settings → API** |
| `SUPABASE_SERVICE_ROLE_KEY` | *(from Supabase)* | Server-only service-role key from **Project Settings → API** |
| `AUTH_SECRET` | *(generate)* | Min 32 random characters |
| `OPENAI_API_KEY` | *(from OpenAI)* | |
| `OPENAI_VECTOR_STORE_ID` | *(from OpenAI)* | e.g. `vs_...` |
| `ATLASSIAN_BASE_URL` | `https://churchofthehighlands.atlassian.net/` | Trailing slash OK |
| `CRON_SECRET` | *(generate)* | Same value used in EventBridge job |

**Supabase API settings:** [Project Settings → API](https://supabase.com/dashboard/project/vsuhzudjyclfaojwrhrd/settings/api)

Example shape:

```text
SUPABASE_URL=https://vsuhzudjyclfaojwrhrd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY]
```

### Optional

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `OPENAI_MODEL` | `gpt-4.1-mini` | |
| `CHAT_RATE_LIMIT` | `20` | Requests per minute |
| `SYNC_RATE_LIMIT` | `5` | Requests per minute |
| `ENTRA_CLIENT_ID` | — | Only if enabling Microsoft login |
| `ENTRA_CLIENT_SECRET` | — | |
| `ENTRA_TENANT_ID` | — | Redirect: `https://helper.highlands.io/api/auth/callback/microsoft-entra-id` |

### Do not set

- Apply reviewed SQL files in [supabase/migrations](../supabase/migrations) before deploying application code.

---

## Phase 3 — Custom domain

- [ ] Amplify → **Hosting → Custom domains**
- [ ] Add **`helper.highlands.io`**
- [ ] Create DNS records (CNAME/ALIAS) per Amplify instructions
- [ ] Wait for SSL certificate **Issued**
- [ ] Confirm `APP_URL` env var matches final HTTPS URL
- [ ] Redeploy if domain or env vars changed after first deploy

---

## Phase 4 — First deploy & verify

- [ ] Trigger deploy (push to `main` or **Redeploy this version**)
- [ ] Build succeeds through: `npm run build`
- [ ] Health check:

```bash
curl https://helper.highlands.io/api/health
```

Expected: `"status":"ok"`

- [ ] Open `https://helper.highlands.io/chat`
- [ ] Open `https://helper.highlands.io/admin/sources`

---

## Phase 5 — Documentation sources (one-time / ongoing)

Sources are **not** configured in code. Add via UI or CLI, then sync.

- [ ] Admin → **Sources** → add Confluence URL or external share link
- [ ] Run **Sync source** or **Run full sync**
- [ ] Confirm source status = **`SYNCED`** in Admin

CLI alternative (from dev machine with production `.env`):

```bash
npm run add-source -- "<confluence-url>"
npm run sync
```

---

## Phase 6 — Nightly sync (EventBridge)

| Setting | Value |
| -------- | ----- |
| **Service** | Amazon EventBridge **Scheduler** |
| **Schedule name** | `checkinhelper-nightly-sync` |
| **Cron (UTC)** | `cron(0 3 * * ? *)` |
| **Plain English** | Every day at **3:00 AM UTC** |
| **URL** | `https://helper.highlands.io/api/cron/sync` |
| **HTTP method** | `GET` |
| **Header** | `Authorization: Bearer <CRON_SECRET>` |
| **Retries** | 2 (recommended) |

### Setup checklist

- [ ] Create EventBridge schedule (Lambda curl or API destination — see [amplify.md](./amplify.md))
- [ ] Use **identical** `CRON_SECRET` as Amplify env var
- [ ] **Run once manually** and confirm JSON response
- [ ] Confirm run appears in app **Admin → Sync**
- [ ] If sync fails (Playwright/timeout), fall back to local `npm run sync` on a schedule or fix Lambda timeout (suggest 5–10 min)

### Manual test command

```bash
curl -X GET "https://helper.highlands.io/api/cron/sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Phase 7 — Post-launch

- [ ] Document where secrets live (Amplify env + EventBridge/Lambda only — not in git)
- [ ] Confirm Supabase **Table Editor → schema `public`** shows app tables (`User`, `KnowledgeSource`, etc.)
- [ ] Add new doc links via **Admin → Sources** (not database, not repo files)
- [ ] Monitor first nightly sync after EventBridge is live

---

## Reference docs

- [docs/amplify.md](./amplify.md) — full Amplify guide
- [docs/supabase.md](./supabase.md) — database connection details
- [docs/synchronization.md](./synchronization.md) — sync behavior
