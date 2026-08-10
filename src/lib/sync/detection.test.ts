import { describe, expect, it } from "vitest";
import { detectSourceChange } from "@/lib/sync/detection";
import { hashContent } from "@/lib/logger";

describe("detectSourceChange", () => {
  const markdown = "---\ntitle: Test\n---\n\n# Test\n";

  it("detects new sources", () => {
    expect(
      detectSourceChange(
        { lastKnownVersion: null, contentHash: null, openaiFileId: null },
        1,
        markdown,
      ).changed,
    ).toBe(true);
  });

  it("detects unchanged sources", () => {
    const hash = hashContent(markdown);
    expect(
      detectSourceChange(
        { lastKnownVersion: 3, contentHash: hash, openaiFileId: "file-1" },
        3,
        markdown,
      ),
    ).toEqual({ changed: false, reason: "unchanged" });
  });

  it("detects version changes", () => {
    const hash = hashContent(markdown);
    expect(
      detectSourceChange(
        { lastKnownVersion: 2, contentHash: hash, openaiFileId: "file-1" },
        3,
        markdown,
      ).reason,
    ).toBe("version");
  });
});

describe("hashContent", () => {
  it("is deterministic", () => {
    expect(hashContent("abc")).toEqual(hashContent("abc"));
    expect(hashContent("abc")).not.toEqual(hashContent("abcd"));
  });
});
