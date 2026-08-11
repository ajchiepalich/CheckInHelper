export type ParsedConfluenceReference =
  | { kind: "pageId"; pageId: string }
  | { kind: "url"; pageId: string; url: string }
  | { kind: "external"; pageId: string; token: string; url: string };

const PAGE_ID_PATTERN = /^\d+$/;

export function parseConfluencePageId(input: string): string | null {
  const trimmed = input.trim();
  if (PAGE_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function externalPageId(token: string): string {
  return `external:${token}`;
}

export function parseExternalToken(input: string): string | null {
  const trimmed = input.trim();

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/wiki\/external\/([^/]+)/);
    if (match?.[1]) return match[1];
  } catch {
    if (/^[A-Za-z0-9+/=_-]+$/.test(trimmed) && trimmed.length >= 16) {
      return trimmed;
    }
  }

  return null;
}

export function buildExternalShareUrl(baseUrl: string, token: string): string {
  return `${normalizeBaseUrl(baseUrl)}/wiki/external/${token}`;
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
    const externalMatch = url.pathname.match(/\/wiki\/external\/([^/]+)/);
    if (externalMatch?.[1]) {
      return {
        kind: "external",
        pageId: externalPageId(externalMatch[1]),
        token: externalMatch[1],
        url: trimmed,
      };
    }

    const viewMatch = url.pathname.match(/\/pages\/(\d+)/);
    if (viewMatch?.[1]) {
      return { kind: "url", pageId: viewMatch[1], url: trimmed };
    }

    const tinyLink = url.searchParams.get("pageId");
    if (tinyLink && PAGE_ID_PATTERN.test(tinyLink)) {
      return { kind: "url", pageId: tinyLink, url: trimmed };
    }
  } catch {
    const externalToken = parseExternalToken(trimmed);
    if (externalToken) {
      return {
        kind: "external",
        pageId: externalPageId(externalToken),
        token: externalToken,
        url: trimmed,
      };
    }
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
