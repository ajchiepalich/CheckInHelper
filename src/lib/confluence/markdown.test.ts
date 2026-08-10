import { describe, expect, it } from "vitest";
import {
  convertConfluenceHtmlToMarkdown,
  buildMarkdownDocument,
} from "@/lib/confluence/markdown";

describe("convertConfluenceHtmlToMarkdown", () => {
  it("preserves headings and lists", () => {
    const html =
      "<h1>Title</h1><p>Intro</p><ol><li>Step one</li><li>Step two</li></ol><ul><li>Note</li></ul>";
    const result = convertConfluenceHtmlToMarkdown(html);
    expect(result.markdown).toContain("# Title");
    expect(result.markdown).toContain("Step one");
    expect(result.markdown).toContain("Note");
  });

  it("flags empty content", () => {
    const result = convertConfluenceHtmlToMarkdown("");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("buildMarkdownDocument", () => {
  it("includes frontmatter and source link", () => {
    const doc = buildMarkdownDocument(
      {
        confluencePageId: "10001",
        title: "Support",
        sourceUrl: "https://example.atlassian.net/wiki/pages/10001",
        version: 2,
        confluenceUpdatedAt: "2026-07-01T00:00:00.000Z",
        indexedAt: "2026-07-02T00:00:00.000Z",
      },
      "Body content",
    );

    expect(doc).toContain('confluence_page_id: "10001"');
    expect(doc).toContain("# Support");
    expect(doc).toContain("Open the original Confluence page");
  });
});
