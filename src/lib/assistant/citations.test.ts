import { describe, expect, it } from "vitest";
import {
  buildRetrievalDiagnostics,
  buildSourceFileMap,
  mapSupportingCitations,
  shouldIncludeCitations,
} from "@/lib/assistant/citations";
import { NO_SOURCE_FALLBACK } from "@/lib/assistant/prompts";

describe("citation mapping", () => {
  const sourceMap = buildSourceFileMap([
    {
      id: "source-1",
      title: "Requesting Technology Support",
      sourceUrl: "https://highlands.atlassian.net/wiki/spaces/IT/pages/10001",
      confluencePageId: "10001",
      spaceKey: "IT",
      lastKnownUpdatedAt: new Date("2026-07-01T12:00:00.000Z"),
      lastKnownVersion: 14,
      openaiFileId: "file-1",
    },
    {
      id: "source-2",
      title: "Unrelated Page",
      sourceUrl: "https://highlands.atlassian.net/wiki/spaces/IT/pages/10002",
      confluencePageId: "10002",
      spaceKey: "IT",
      lastKnownUpdatedAt: new Date("2026-06-01T12:00:00.000Z"),
      lastKnownVersion: 3,
      openaiFileId: "file-2",
    },
  ]);

  it("maps only cited OpenAI files that exist in the source registry", () => {
    const citations = mapSupportingCitations(
      [
        { fileId: "file-1", snippet: "Open the IT Service Portal." },
        { fileId: "file-unknown", snippet: "Should be ignored." },
      ],
      sourceMap,
    );

    expect(citations).toHaveLength(1);
    expect(citations[0]?.title).toBe("Requesting Technology Support");
    expect(citations[0]?.snippet).toBe("Open the IT Service Portal.");
    expect(citations[0]?.knowledgeSourceId).toBe("source-1");
  });

  it("does not expose citations for fallback answers", () => {
    expect(
      shouldIncludeCitations(NO_SOURCE_FALLBACK, [
        {
          title: "Requesting Technology Support",
          sourceUrl: "https://example.com",
          knowledgeSourceId: "source-1",
        },
      ]),
    ).toEqual([]);
  });

  it("builds internal diagnostics without exposing scores to UI payloads", () => {
    const supporting = mapSupportingCitations(
      [{ fileId: "file-1", snippet: "Portal steps" }],
      sourceMap,
    );

    const diagnostics = buildRetrievalDiagnostics({
      traceId: "trace-1",
      openaiResponseId: "resp-1",
      retrievalResults: [
        { fileId: "file-1", score: 0.91, snippet: "Portal steps" },
        { fileId: "file-2", score: 0.42, snippet: "Other content" },
      ],
      citedFiles: [{ fileId: "file-1", snippet: "Portal steps" }],
      supportingCitations: supporting,
    });

    expect(diagnostics.retrievedFileIds).toEqual(["file-1", "file-2"]);
    expect(diagnostics.citedFileIds).toEqual(["file-1"]);
    expect(diagnostics.supportingSourceIds).toEqual(["source-1"]);
    expect(diagnostics.retrievalResults[0]?.score).toBe(0.91);
  });
});
