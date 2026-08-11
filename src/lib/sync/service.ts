import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import {
  AuditEventType,
  SourceStatus,
  SyncItemStatus,
  SyncRunStatus,
  SyncTriggerType,
  type KnowledgeSource,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
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
  const lock = await prisma.syncLock.upsert({
    where: { id: "global" },
    create: { id: "global", lockedAt: new Date(), syncRunId },
    update: {},
  });

  if (lock.lockedAt && lock.syncRunId && lock.syncRunId !== syncRunId) {
    const ageMs = Date.now() - lock.lockedAt.getTime();
    if (ageMs < 60 * 60 * 1000) {
      return false;
    }
  }

  await prisma.syncLock.update({
    where: { id: "global" },
    data: { lockedAt: new Date(), syncRunId },
  });
  return true;
}

async function releaseSyncLock(syncRunId: string): Promise<void> {
  await prisma.syncLock.updateMany({
    where: { id: "global", syncRunId },
    data: { lockedAt: null, syncRunId: null },
  });
}

export async function runSynchronization(
  options: SyncOptions,
): Promise<SyncResult> {
  const env = getEnv();
  const syncRun = await prisma.syncRun.create({
    data: {
      status: SyncRunStatus.RUNNING,
      triggerType: options.triggerType,
      triggeredById: options.triggeredById,
      dryRun: options.dryRun ?? false,
      lockAcquired: false,
    },
  });

  const isFullRun = !options.sourceId;
  if (isFullRun) {
    const acquired = await acquireSyncLock(syncRun.id);
    if (!acquired) {
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: SyncRunStatus.CANCELLED,
          finishedAt: new Date(),
          errorSummary: "Another sync run is already in progress.",
        },
      });
      return {
        syncRunId: syncRun.id,
        status: SyncRunStatus.CANCELLED,
        summary: { added: 0, updated: 0, unchanged: 0, failed: 0 },
      };
    }
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { lockAcquired: true },
    });
  }

  const confluence = createConfluenceService({
    mock: isLocalMockMode(),
    baseUrl: env.ATLASSIAN_BASE_URL,
  });

  const vectorStore = isLocalMockMode() ? null : new OpenAIVectorStoreService();

  const where: Prisma.KnowledgeSourceWhereInput = {
    enabled: true,
    sourceType: "EXPLICIT_PAGE",
  };

  if (options.sourceId) {
    where.id = options.sourceId;
  }

  if (options.retryFailedOnly) {
    where.status = { in: [SourceStatus.FAILED, SourceStatus.UNAVAILABLE] };
  }

  const sources = await prisma.knowledgeSource.findMany({ where });

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  const tempDir = path.join(process.cwd(), ".tmp", "sync", syncRun.id);
  await mkdir(tempDir, { recursive: true });

  try {
    for (const source of sources) {
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
        await prisma.syncItem.create({
          data: {
            syncRunId: syncRun.id,
            knowledgeSourceId: source.id,
            status: SyncItemStatus.FAILED,
            message:
              error instanceof Error ? error.message : "Unknown sync error",
          },
        });
        await prisma.knowledgeSource.update({
          where: { id: source.id },
          data: {
            status: SourceStatus.FAILED,
            lastError:
              error instanceof Error ? error.message : "Unknown sync error",
            lastAttemptedSyncAt: new Date(),
          },
        });
      }
    }

    const finalStatus =
      failed > 0 && added + updated + unchanged === 0
        ? SyncRunStatus.FAILED
        : SyncRunStatus.COMPLETED;

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        addedCount: added,
        updatedCount: updated,
        unchangedCount: unchanged,
        failedCount: failed,
        errorSummary:
          failed > 0 ? `${failed} source(s) failed during sync.` : null,
      },
    });

    if (options.triggeredById) {
      await prisma.auditEvent.create({
        data: {
          type:
            finalStatus === SyncRunStatus.COMPLETED
              ? AuditEventType.SYNC_COMPLETED
              : AuditEventType.SYNC_FAILED,
          userId: options.triggeredById,
          entityType: "SyncRun",
          entityId: syncRun.id,
          metadata: { added, updated, unchanged, failed },
        },
      });
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

      await prisma.knowledgeSource.update({
        where: { id: source.id },
        data: {
          status,
          lastError: error.message,
          lastAttemptedSyncAt: new Date(),
        },
      });
      await prisma.syncItem.create({
        data: {
          syncRunId: params.syncRunId,
          knowledgeSourceId: source.id,
          status: SyncItemStatus.FAILED,
          message: error.message,
        },
      });
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
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: {
        status: SourceStatus.UNCHANGED,
        lastAttemptedSyncAt: new Date(),
        lastError: conversion.warnings.length
          ? conversion.warnings.join("; ")
          : null,
      },
    });
    await prisma.syncItem.create({
      data: {
        syncRunId: params.syncRunId,
        knowledgeSourceId: source.id,
        status: SyncItemStatus.UNCHANGED,
        message: "No changes detected.",
      },
    });
    return SyncItemStatus.UNCHANGED;
  }

  if (params.dryRun) {
    await prisma.syncItem.create({
      data: {
        syncRunId: params.syncRunId,
        knowledgeSourceId: source.id,
        status: SyncItemStatus.SKIPPED,
        message: `Dry run: would ${source.openaiFileId ? "update" : "add"} source.`,
      },
    });
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

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeFile.updateMany({
      where: { knowledgeSourceId: source.id, isActive: true },
      data: { isActive: false, replacedAt: new Date() },
    });

    await tx.knowledgeFile.create({
      data: {
        knowledgeSourceId: source.id,
        openaiFileId: newFileId,
        contentHash,
        version: page.version,
        isActive: true,
      },
    });

    await tx.knowledgeSource.update({
      where: { id: source.id },
      data: {
        title: page.title,
        sourceUrl: page.webUrl,
        spaceId: page.spaceId,
        spaceKey: page.spaceKey,
        lastKnownVersion: page.version,
        lastKnownUpdatedAt: new Date(page.updatedAt),
        contentHash,
        openaiFileId: newFileId,
        status: SourceStatus.SYNCED,
        lastSuccessfulSyncAt: new Date(),
        lastAttemptedSyncAt: new Date(),
        lastError: conversion.warnings.length
          ? conversion.warnings.join("; ")
          : null,
      },
    });

    await tx.syncItem.create({
      data: {
        syncRunId: params.syncRunId,
        knowledgeSourceId: source.id,
        status: source.openaiFileId
          ? SyncItemStatus.UPDATED
          : SyncItemStatus.ADDED,
        previousFileId: previousFileId,
        newFileId,
        message: change.reason,
      },
    });
  });

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

  const existing = await prisma.knowledgeSource.findFirst({
    where: { confluencePageId: page.id, sourceType: "EXPLICIT_PAGE" },
  });
  if (existing) {
    throw new Error("This Confluence page is already registered as a source.");
  }

  const source = await prisma.knowledgeSource.create({
    data: {
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
    },
  });

  if (input.userId) {
    await prisma.auditEvent.create({
      data: {
        type: AuditEventType.SOURCE_CREATED,
        userId: input.userId,
        entityType: "KnowledgeSource",
        entityId: source.id,
        metadata: {
          title: source.title,
          confluencePageId: source.confluencePageId,
        },
      },
    });
  }

  return source;
}
