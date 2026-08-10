# Synchronization

## Modes

| Mode                | Trigger             | Notes                                |
| ------------------- | ------------------- | ------------------------------------ |
| Full reconciliation | Admin UI, CLI, cron | All enabled explicit sources         |
| Single source       | Admin source card   | One page                             |
| Retry failed        | Admin sync panel    | Sources in `FAILED` or `UNAVAILABLE` |
| Dry run             | Admin sync panel    | Detects changes without uploading    |

## Incremental behavior

A source is skipped when both Confluence version and content hash match stored values.

When changed:

1. Markdown is generated in a temp directory
2. File is uploaded to OpenAI
3. File is attached to the vector store
4. Indexing is polled until complete or failed
5. Database records are updated
6. Previous OpenAI file is deleted only after successful indexing

## Locking

`SyncLock` prevents overlapping full sync runs for up to one hour. Single-source syncs do not acquire the global lock.

## Source types

### Explicit page (supported)

Syncs one Confluence page by stable page ID.

### Parent with descendants (planned)

Data model supports `includeDescendants=true`. Implementation requires Confluence content tree traversal and child page deduplication.

### Label (planned)

Data model supports `labelName`. Implementation requires Confluence CQL search by label and pagination.

## Failure handling

- Missing page → source marked `UNAVAILABLE`
- Conversion warnings stored in `lastError` but do not block successful sync
- Indexing failure preserves the previous active OpenAI file

## CLI

```bash
npm run sync
npm run sync -- --dry-run
npm run sync -- --source=clsource123
npm run sync -- --retry-failed
```

## Cron

```bash
curl -X GET "$APP_URL/api/cron/sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Vercel cron is configured in `vercel.json` for 03:00 UTC daily.
