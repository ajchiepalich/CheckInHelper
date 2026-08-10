export type ParsedConfluenceReference =
  | { kind: "pageId"; pageId: string }
  | { kind: "url"; pageId: string; url: string };

const PAGE_ID_PATTERN = /^\d+$/;

export function parseConfluencePageId(input: string): string | null {
  const trimmed = input.trim();
  if (PAGE_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function parseConfluenceUrl(
  input: string,
): ParsedConfluenceReference | null {
  const trimmed = input.trim();

  const directId = parseConfluencePageId(trimmed);
  if (directId) {
    return { kind: "pageId", pageId: directId };
  }

  try {
    const url = new URL(trimmed);
    const viewMatch = url.pathname.match(/\/pages\/(\d+)/);
    if (viewMatch?.[1]) {
      return { kind: "url", pageId: viewMatch[1], url: trimmed };
    }

    const tinyLink = url.searchParams.get("pageId");
    if (tinyLink && PAGE_ID_PATTERN.test(tinyLink)) {
      return { kind: "url", pageId: tinyLink, url: trimmed };
    }
  } catch {
    return null;
  }

  return null;
}

export function buildConfluencePageUrl(
  baseUrl: string,
  pageId: string,
  title?: string,
): string {
  const base = baseUrl.replace(/\/$/, "");
  if (title) {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${base}/wiki/spaces/SPACE/pages/${pageId}/${slug}`;
  }
  return `${base}/wiki/pages/viewpage.action?pageId=${pageId}`;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}
