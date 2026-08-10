import { describe, expect, it, vi, beforeEach } from "vitest";
import { SourceStatus } from "@prisma/client";

vi.mock("@/lib/db", () => ({
  prisma: {
    syncRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
    syncLock: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    knowledgeSource: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    knowledgeFile: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    syncItem: {
      create: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        knowledgeFile: {
          updateMany: vi.fn(),
          create: vi.fn(),
        },
        knowledgeSource: {
          update: vi.fn(),
        },
        syncItem: {
          create: vi.fn(),
        },
      }),
    ),
  },
}));

vi.mock("@/lib/confluence/service", () => ({
  createConfluenceService: () => ({
    fetchPage: vi.fn().mockResolvedValue({
      id: "10001",
      title: "Requesting Technology Support",
      version: 15,
      spaceId: "1000",
      spaceKey: "IT",
      webUrl: "https://highlands.atlassian.net/wiki/spaces/IT/pages/10001",
      bodyHtml: "<h1>Requesting Technology Support</h1><p>Updated body</p>",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }),
    validatePage: vi.fn().mockResolvedValue({
      id: "10001",
      title: "Requesting Technology Support",
      version: 15,
      spaceId: "1000",
      spaceKey: "IT",
      webUrl: "https://highlands.atlassian.net/wiki/spaces/IT/pages/10001",
      bodyHtml: "<h1>Requesting Technology Support</h1><p>Updated body</p>",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }),
  }),
  ConfluenceNotFoundError: class ConfluenceNotFoundError extends Error {},
}));

describe("runSynchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a sync run and processes enabled sources", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.syncRun.create).mockResolvedValue({
      id: "run-1",
      status: "RUNNING",
      triggerType: "MANUAL",
      triggeredById: null,
      dryRun: false,
      startedAt: new Date(),
      finishedAt: null,
      addedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      removedCount: 0,
      failedCount: 0,
      errorSummary: null,
      lockAcquired: false,
    } as never);
    vi.mocked(prisma.syncLock.upsert).mockResolvedValue({
      id: "global",
      lockedAt: null,
      syncRunId: null,
      updatedAt: new Date(),
    });
    vi.mocked(prisma.knowledgeSource.findMany).mockResolvedValue([
      {
        id: "source-1",
        confluencePageId: "10001",
        sourceUrl: "https://example.com/10001",
        title: "Support",
        spaceId: "1000",
        spaceKey: "IT",
        sourceType: "EXPLICIT_PAGE",
        category: "it",
        audience: "staff",
        classification: "internal",
        enabled: true,
        includeDescendants: false,
        labelName: null,
        lastKnownVersion: 14,
        lastKnownUpdatedAt: new Date("2026-07-01"),
        contentHash: "old-hash",
        openaiFileId: "file-old",
        lastSuccessfulSyncAt: new Date(),
        lastAttemptedSyncAt: new Date(),
        status: SourceStatus.SYNCED,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    const { runSynchronization } = await import("@/lib/sync/service");
    const result = await runSynchronization({ triggerType: "MANUAL" });
    expect(result.syncRunId).toBe("run-1");
    expect(prisma.syncRun.create).toHaveBeenCalled();
  });
});

describe("validateAndCreateSource", () => {
  it("rejects duplicate explicit pages", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.knowledgeSource.findFirst).mockResolvedValue({
      id: "existing",
    } as never);

    const { validateAndCreateSource } = await import("@/lib/sync/service");
    await expect(
      validateAndCreateSource({ pageIdOrUrl: "10001" }),
    ).rejects.toThrow(/already registered/);
  });
});
