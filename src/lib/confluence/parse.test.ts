import { describe, expect, it } from "vitest";
import {
  parseConfluenceUrl,
  buildConfluencePageUrl,
} from "@/lib/confluence/parse";

describe("parseConfluenceUrl", () => {
  it("parses numeric page IDs", () => {
    expect(parseConfluenceUrl("123456789")).toEqual({
      kind: "pageId",
      pageId: "123456789",
    });
  });

  it("parses standard Confluence URLs", () => {
    const result = parseConfluenceUrl(
      "https://highlands.atlassian.net/wiki/spaces/IT/pages/123456/Support",
    );
    expect(result).toEqual({
      kind: "url",
      pageId: "123456",
      url: "https://highlands.atlassian.net/wiki/spaces/IT/pages/123456/Support",
    });
  });

  it("parses external share URLs", () => {
    const url =
      "https://churchofthehighlands.atlassian.net/wiki/external/ZDkyNjRlMWEyYmM2NGY4MmE5ZTA4NTliZWVmNGI2ZWM";
    expect(parseConfluenceUrl(url)).toEqual({
      kind: "external",
      pageId:
        "external:ZDkyNjRlMWEyYmM2NGY4MmE5ZTA4NTliZWVmNGI2ZWM",
      token: "ZDkyNjRlMWEyYmM2NGY4MmE5ZTA4NTliZWVmNGI2ZWM",
      url,
    });
  });

  it("returns null for invalid input", () => {
    expect(parseConfluenceUrl("not-a-url")).toBeNull();
  });
});

describe("buildConfluencePageUrl", () => {
  it("builds a page URL with slug", () => {
    expect(
      buildConfluencePageUrl(
        "https://highlands.atlassian.net",
        "123",
        "Support Page",
      ),
    ).toContain("/pages/123/support-page");
  });
});
