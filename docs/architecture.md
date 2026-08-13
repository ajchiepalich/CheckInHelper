# Architecture

## Overview

The Highlands Documentation Assistant is a retrieval-augmented generation (RAG) application. Confluence remains the source of truth. The app converts approved pages to Markdown, indexes them in an OpenAI vector store, and answers staff questions through the OpenAI Responses API with `file_search`.

## Layers

### Presentation

- Next.js App Router pages for chat, history, and admin
- Server Components for protected admin data loading
- Client Components for streaming chat and admin actions

### API

- `/api/chat` — authenticated SSE streaming
- `/api/feedback` — staff feedback
- `/api/admin/*` — admin-only source and sync operations
- `/api/cron/sync` — bearer-protected scheduled sync

### Domain services

- `ConfluenceService` — typed Confluence REST integration with mock implementation
- `RetrievalProvider` — OpenAI Responses API or mock provider
- `runSynchronization` — incremental indexing workflow
- Auth helpers — Entra ID + local development credentials

### Data

Supabase PostgreSQL stores users, conversations, messages, citations, sources, sync runs, feedback, and audit events. Server code accesses it through the Supabase JavaScript client.

## Request flow (chat)

1. Staff submits a question on `/chat`.
2. `/api/chat` validates auth and rate limits, stores the user message.
3. `RetrievalProvider.streamChat()` calls OpenAI Responses API with `file_search` against the configured vector store.
4. The server streams text deltas to the browser.
5. File citations are mapped to `KnowledgeSource` records by OpenAI file ID.
6. Assistant message and citations are persisted.

## Sync flow

1. Admin or cron triggers sync.
2. A global DB lock prevents overlapping full runs.
3. For each enabled explicit page source:
   - Fetch Confluence page
   - Convert storage HTML to Markdown with frontmatter
   - Compare version/hash
   - Upload and attach to vector store if changed
   - Poll indexing
   - Replace DB file reference and delete old OpenAI file only after success

## Extensibility

- `RetrievalProvider` can be swapped for another LLM/retrieval backend.
- `ConfluenceService` can be replaced with a cached or enterprise gateway implementation.
- Source types `PARENT_WITH_DESCENDANTS` and `LABEL` are modeled for future traversal logic.

## Observability

Structured JSON logs include trace ID, OpenAI request ID, sync run ID, latency, retrieval count, and citation count. Message content is not logged by default.
