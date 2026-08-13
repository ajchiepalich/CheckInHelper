import { describe, expect, it, vi } from "vitest";

const source = {
  id: "source-1", confluencePageId: "10001", sourceUrl: "https://example.com/10001", title: "Support",
  spaceId: "1000", spaceKey: "IT", sourceType: "EXPLICIT_PAGE", category: "it", audience: "staff",
  classification: "internal", enabled: true, includeDescendants: false, labelName: null, lastKnownVersion: 14,
  lastKnownUpdatedAt: "2026-07-01T00:00:00.000Z", contentHash: "old-hash", openaiFileId: "file-old",
  lastSuccessfulSyncAt: null, lastAttemptedSyncAt: null, status: "SYNCED", lastError: null,
  createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
};

function query(table: string) {
  const result = () => {
    if (table === "SyncRun") return { data: { id: "run-1" }, error: null };
    if (table === "KnowledgeSource") return { data: [source], error: null };
    if (table === "SyncLock") return { data: null, error: null };
    return { data: null, error: null };
  };
  const chain: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve),
  };
  for (const method of ["select", "insert", "update", "upsert", "eq", "in", "not", "order", "limit", "maybeSingle", "single"]) {
    chain[method] = () => chain;
  }
  return chain;
}

vi.mock("@/lib/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db")>("@/lib/db");
  return { ...actual, getDb: () => ({ from: (table: string) => query(table) }) };
});

vi.mock("@/lib/confluence/service", () => ({
  createConfluenceService: () => ({
    fetchPage: vi.fn().mockResolvedValue({
      id: "10001", title: "Support", version: 15, spaceId: "1000", spaceKey: "IT",
      webUrl: "https://example.com/10001", bodyHtml: "<p>Updated body</p>",
      updatedAt: "2026-07-28T00:00:00.000Z",
    }),
    validatePage: vi.fn(),
  }),
  ConfluenceNotFoundError: class ConfluenceNotFoundError extends Error { },
  ConfluenceAccessDeniedError: class ConfluenceAccessDeniedError extends Error { },
}));

describe("runSynchronization", () => {
  it("creates and processes a sync run through the Supabase client", async () => {
    const { runSynchronization } = await import("@/lib/sync/service");
    const result = await runSynchronization({ triggerType: "MANUAL", dryRun: true });
    expect(result.syncRunId).toBe("run-1");
  });
});
