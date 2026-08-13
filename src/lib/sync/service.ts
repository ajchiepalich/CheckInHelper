import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import {
  AuditEventType,
  SourceStatus,
  SyncItemStatus,
  SyncRunStatus,
  SyncTriggerType,
  type KnowledgeSource,
  createId,
  dbError,
  getDb,
} from "@/lib/db";
import { getEnv, isLocalMockMode } from "@/lib/env";
import { buildMarkdownDocument } from "@/lib/confluence/markdown";
import {
  createConfluenceService,
  ConfluenceNotFoundError,
  ConfluenceAccessDeniedError,
} from "@/lib/confluence/service";
import { hashContent, logError, logInfo } from "@/lib/logger";
import { detectSourceChange } from "@/lib/sync/detection";
import { OpenAIVectorStoreService } from "@/lib/assistant/openai-provider";

export type SyncOptions = {
  triggerType: SyncTriggerType;
  triggeredById?: string;
  sourceId?: string;
  dryRun?: boolean;
  retryFailedOnly?: boolean;
};

export type SyncResult = {
  syncRunId: string;
  status: SyncRunStatus;
  summary: {
    added: number;
    updated: number;
    unchanged: number;
    failed: number;
  };
};

async function acquireSyncLock(syncRunId: string): Promise<boolean> {
  const db = getDb();
  const { data: lock, error } = await db.from("SyncLock").select("lockedAt, syncRunId").eq("id", "global").maybeSingle();
  if (error) dbError(error, "Unable to read sync lock");

  if (lock?.lockedAt && lock.syncRunId && lock.syncRunId !== syncRunId) {
    const ageMs = Date.now() - new Date(lock.lockedAt).getTime();
    if (ageMs < 60 * 60 * 1000) {
      return false;
    }
  }

  const { error: updateError } = await db.from("SyncLock").upsert({
    id: "global",
    lockedAt: new Date().toISOString(),
    syncRunId,
    updatedAt: new Date().toISOString(),
  }, { onConflict: "id" });
  if (updateError) dbError(updateError, "Unable to acquire sync lock");
  return true;
}

async function releaseSyncLock(syncRunId: string): Promise<void> {
  const { error } = await getDb().from("SyncLock").update({ lockedAt: null, syncRunId: null }).eq("id", "global").eq("syncRunId", syncRunId);
  if (error) dbError(error, "Unable to release sync lock");
}

export async function runSynchronization(
  options: SyncOptions,
): Promise<SyncResult> {
  const env = getEnv();
  const { data: syncRun, error: syncRunError } = await getDb().from("SyncRun").insert({
    id: createId(),
    status: SyncRunStatus.RUNNING,
    triggerType: options.triggerType,
    triggeredById: options.triggeredById,
    dryRun: options.dryRun ?? false,
    lockAcquired: false,
  }).select("id").single();
  if (syncRunError || !syncRun) dbError(syncRunError, "Unable to create sync run");

  const isFullRun = !options.sourceId;
  if (isFullRun) {
    const acquired = await acquireSyncLock(syncRun.id);
    if (!acquired) {
      const { error } = await getDb().from("SyncRun").update({
        status: SyncRunStatus.CANCELLED,
        finishedAt: new Date().toISOString(),
        errorSummary: "Another sync run is already in progress.",
      }).eq("id", syncRun.id);
      if (error) dbError(error, "Unable to cancel sync run");
      return {
        syncRunId: syncRun.id,
        status: SyncRunStatus.CANCELLED,
        summary: { added: 0, updated: 0, unchanged: 0, failed: 0 },
      };
    }
    const { error } = await getDb().from("SyncRun").update({ lockAcquired: true }).eq("id", syncRun.id);
    if (error) dbError(error, "Unable to update sync run");
  }

  const confluence = createConfluenceService({
    mock: isLocalMockMode(),
    baseUrl: env.ATLASSIAN_BASE_URL,
  });

  const vectorStore = isLocalMockMode() ? null : new OpenAIVectorStoreService();

  let query = getDb().from("KnowledgeSource").select("*").eq("enabled", true).eq("sourceType", "EXPLICIT_PAGE");
  if (options.sourceId) query = query.eq("id", options.sourceId);
  if (options.retryFailedOnly) query = query.in("status", [SourceStatus.FAILED, SourceStatus.UNAVAILABLE]);
  const { data: sources, error: sourcesError } = await query;
  if (sourcesError) dbError(sourcesError, "Unable to load sources");

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  const tempDir = path.join(process.cwd(), ".tmp", "sync", syncRun.id);
  await mkdir(tempDir, { recursive: true });

  try {
    for (const source of (sources ?? []) as KnowledgeSource[]) {
      try {
        const result = await syncSingleSource({
          source,
          confluence,
          vectorStore,
          vectorStoreId: env.OPENAI_VECTOR_STORE_ID,
          syncRunId: syncRun.id,
          dryRun: options.dryRun ?? false,
          tempDir,
          mockMode: isLocalMockMode(),
        });

        if (result === SyncItemStatus.ADDED) added += 1;
        else if (result === SyncItemStatus.UPDATED) updated += 1;
        else if (result === SyncItemStatus.UNCHANGED) unchanged += 1;
        else if (result === SyncItemStatus.FAILED) failed += 1;
      } catch (error) {
        failed += 1;
        logError("sync.source.failed", error, {
          syncRunId: syncRun.id,
          sourceId: source.id,
        });
        const { error: itemError } = await getDb().from("SyncItem").insert({
          id: createId(),
          syncRunId: syncRun.id,
          knowledgeSourceId: source.id,
          status: SyncItemStatus.FAILED,
          message:
            error instanceof Error ? error.message : "Unknown sync error",
        });
        if (itemError) dbError(itemError, "Unable to create sync item");
        const { error: sourceError } = await getDb().from("KnowledgeSource").update({
          status: SourceStatus.FAILED,
          lastError:
            error instanceof Error ? error.message : "Unknown sync error",
          lastAttemptedSyncAt: new Date().toISOString(),
        }).eq("id", source.id);
        if (sourceError) dbError(sourceError, "Unable to update source");
      }
    }

    const finalStatus =
      failed > 0 && added + updated + unchanged === 0
        ? SyncRunStatus.FAILED
        : SyncRunStatus.COMPLETED;

    const { error: finalError } = await getDb().from("SyncRun").update({
      status: finalStatus,
      finishedAt: new Date().toISOString(),
      addedCount: added,
      updatedCount: updated,
      unchangedCount: unchanged,
      failedCount: failed,
      errorSummary:
        failed > 0 ? `${failed} source(s) failed during sync.` : null,
    }).eq("id", syncRun.id);
    if (finalError) dbError(finalError, "Unable to complete sync run");

    if (options.triggeredById) {
      const { error } = await getDb().from("AuditEvent").insert({
        id: createId(),
        type:
          finalStatus === SyncRunStatus.COMPLETED
            ? AuditEventType.SYNC_COMPLETED
            : AuditEventType.SYNC_FAILED,
        userId: options.triggeredById,
        entityType: "SyncRun",
        entityId: syncRun.id,
        metadata: { added, updated, unchanged, failed },
      });
      if (error) dbError(error, "Unable to record audit event");
    }

    logInfo("sync.completed", {
      syncRunId: syncRun.id,
      added,
      updated,
      unchanged,
      failed,
    });

    return {
      syncRunId: syncRun.id,
      status: finalStatus,
      summary: { added, updated, unchanged, failed },
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    if (isFullRun) {
      await releaseSyncLock(syncRun.id);
    }
  }
}

async function syncSingleSource(params: {
  source: KnowledgeSource;
  confluence: ReturnType<typeof createConfluenceService>;
  vectorStore: OpenAIVectorStoreService | null;
  vectorStoreId?: string;
  syncRunId: string;
  dryRun: boolean;
  tempDir: string;
  mockMode: boolean;
}): Promise<SyncItemStatus> {
  const { source } = params;

  let page;
  try {
    page = await params.confluence.fetchPage(source.confluencePageId);
  } catch (error) {
    if (
      error instanceof ConfluenceNotFoundError ||
      error instanceof ConfluenceAccessDeniedError
    ) {
      const status =
        error instanceof ConfluenceAccessDeniedError
          ? SourceStatus.FAILED
          : SourceStatus.UNAVAILABLE;

      const { error: sourceError } = await getDb().from("KnowledgeSource").update({
        status,
        lastError: error.message,
        lastAttemptedSyncAt: new Date().toISOString(),
      }).eq("id", source.id);
      if (sourceError) dbError(sourceError, "Unable to update unavailable source");
      const { error: itemError } = await getDb().from("SyncItem").insert({
        id: createId(),
        syncRunId: params.syncRunId,
        knowledgeSourceId: source.id,
        status: SyncItemStatus.FAILED,
        message: error.message,
      });
      if (itemError) dbError(itemError, "Unable to record unavailable source");
      return SyncItemStatus.FAILED;
    }
    throw error;
  }

  const { convertConfluenceHtmlToMarkdown } =
    await import("@/lib/confluence/markdown");
  const conversion = convertConfluenceHtmlToMarkdown(page.bodyHtml);
  const indexedAt = new Date().toISOString();

  const markdown = buildMarkdownDocument(
    {
      confluencePageId: page.id,
      title: page.title,
      sourceUrl: page.webUrl,
      spaceId: page.spaceId,
      spaceKey: page.spaceKey,
      version: page.version,
      category: source.category ?? undefined,
      audience: source.audience ?? undefined,
      classification: source.classification ?? undefined,
      confluenceUpdatedAt: page.updatedAt,
      indexedAt,
    },
    conversion.markdown,
  );

  const change = detectSourceChange(source, page.version, markdown);

  if (!change.changed) {
    const { error: sourceError } = await getDb().from("KnowledgeSource").update({
      status: SourceStatus.UNCHANGED,
      lastAttemptedSyncAt: new Date().toISOString(),
      lastError: conversion.warnings.length
        ? conversion.warnings.join("; ")
        : null,
    }).eq("id", source.id);
    if (sourceError) dbError(sourceError, "Unable to update unchanged source");
    const { error: itemError } = await getDb().from("SyncItem").insert({
      id: createId(),
      syncRunId: params.syncRunId,
      knowledgeSourceId: source.id,
      status: SyncItemStatus.UNCHANGED,
      message: "No changes detected.",
    });
    if (itemError) dbError(itemError, "Unable to record unchanged source");
    return SyncItemStatus.UNCHANGED;
  }

  if (params.dryRun) {
    const { error } = await getDb().from("SyncItem").insert({
      id: createId(),
      syncRunId: params.syncRunId,
      knowledgeSourceId: source.id,
      status: SyncItemStatus.SKIPPED,
      message: `Dry run: would ${source.openaiFileId ? "update" : "add"} source.`,
    });
    if (error) dbError(error, "Unable to record dry run item");
    return source.openaiFileId ? SyncItemStatus.UPDATED : SyncItemStatus.ADDED;
  }

  const contentHash = hashContent(markdown);
  const fileName = `${page.id}-v${page.version}.md`;
  const filePath = path.join(params.tempDir, fileName);
  await writeFile(filePath, markdown, "utf8");

  let newFileId: string;
  const previousFileId = source.openaiFileId ?? undefined;

  if (params.mockMode) {
    newFileId = `file-mock-${page.id}-${page.version}`;
  } else {
    if (!params.vectorStore || !params.vectorStoreId) {
      throw new Error("Vector store is not configured.");
    }
    const upload = await params.vectorStore.uploadAndAttach({
      filePath,
      fileName,
      vectorStoreId: params.vectorStoreId,
    });
    if (!upload.indexed) {
      throw new Error("OpenAI indexing failed for uploaded file.");
    }
    newFileId = upload.fileId;
  }

  const db = getDb();
  const { error: deactivateError } = await db.from("KnowledgeFile").update({ isActive: false, replacedAt: new Date().toISOString() }).eq("knowledgeSourceId", source.id).eq("isActive", true);
  if (deactivateError) dbError(deactivateError, "Unable to replace source file");
  const { error: fileError } = await db.from("KnowledgeFile").insert({
    id: createId(),
    knowledgeSourceId: source.id,
    openaiFileId: newFileId,
    contentHash,
    version: page.version,
    isActive: true,
  });
  if (fileError) dbError(fileError, "Unable to create source file");
  const { error: updateError } = await db.from("KnowledgeSource").update({
    title: page.title,
    sourceUrl: page.webUrl,
    spaceId: page.spaceId,
    spaceKey: page.spaceKey,
    lastKnownVersion: page.version,
    lastKnownUpdatedAt: new Date(page.updatedAt).toISOString(),
    contentHash,
    openaiFileId: newFileId,
    status: SourceStatus.SYNCED,
    lastSuccessfulSyncAt: new Date().toISOString(),
    lastAttemptedSyncAt: new Date().toISOString(),
    lastError: conversion.warnings.length
      ? conversion.warnings.join("; ")
      : null,
  }).eq("id", source.id);
  if (updateError) dbError(updateError, "Unable to update source after sync");
  const { error: syncItemError } = await db.from("SyncItem").insert({
    id: createId(),
    syncRunId: params.syncRunId,
    knowledgeSourceId: source.id,
    status: source.openaiFileId
      ? SyncItemStatus.UPDATED
      : SyncItemStatus.ADDED,
    previousFileId: previousFileId,
    newFileId,
    message: change.reason,
  });
  if (syncItemError) dbError(syncItemError, "Unable to record sync result");

  if (
    !params.mockMode &&
    previousFileId &&
    params.vectorStore &&
    params.vectorStoreId
  ) {
    await params.vectorStore.removeFile(params.vectorStoreId, previousFileId);
  }

  return source.openaiFileId ? SyncItemStatus.UPDATED : SyncItemStatus.ADDED;
}

export async function validateAndCreateSource(input: {
  pageIdOrUrl: string;
  category?: string;
  audience?: string;
  classification?: string;
  userId?: string;
}) {
  const env = getEnv();
  const { parseConfluenceUrl } = await import("@/lib/confluence/parse");
  const parsed = parseConfluenceUrl(input.pageIdOrUrl);
  if (!parsed) {
    throw new Error("Invalid Confluence URL or page ID.");
  }

  const confluence = createConfluenceService({
    mock: isLocalMockMode(),
    baseUrl: env.ATLASSIAN_BASE_URL,
  });

  const page = await confluence.validatePage(parsed.pageId);
  const sourceUrl =
    parsed.kind === "external" ? parsed.url : page.webUrl;

  const { data: existing, error: existingError } = await getDb().from("KnowledgeSource").select("id").eq("confluencePageId", page.id).eq("sourceType", "EXPLICIT_PAGE").maybeSingle();
  if (existingError) dbError(existingError, "Unable to validate source");
  if (existing) {
    throw new Error("This Confluence page is already registered as a source.");
  }

  const { data: source, error: sourceError } = await getDb().from("KnowledgeSource").insert({
    id: createId(),
    confluencePageId: page.id,
    sourceUrl,
    title: page.title,
    spaceId: page.spaceId,
    spaceKey: page.spaceKey,
    sourceType: "EXPLICIT_PAGE",
    category: input.category,
    audience: input.audience,
    classification: input.classification,
    status: SourceStatus.PENDING,
    updatedAt: new Date().toISOString(),
  }).select("*").single();
  if (sourceError || !source) dbError(sourceError, "Unable to create source");

  if (input.userId) {
    const { error } = await getDb().from("AuditEvent").insert({
      id: createId(),
      type: AuditEventType.SOURCE_CREATED,
      userId: input.userId,
      entityType: "KnowledgeSource",
      entityId: source.id,
      metadata: {
        title: source.title,
        confluencePageId: source.confluencePageId,
      },
    });
    if (error) dbError(error, "Unable to record source audit event");
  }

  return source;
}
