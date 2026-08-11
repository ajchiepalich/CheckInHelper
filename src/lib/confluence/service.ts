import { readFile } from "fs/promises";
import path from "path";
import { normalizeBaseUrl } from "@/lib/confluence/parse";
import {
  externalPageId,
  fetchExternalSharePage,
} from "@/lib/confluence/external-fetch";
import { parseExternalToken } from "@/lib/confluence/parse";

export type ConfluencePage = {
  id: string;
  title: string;
  version: number;
  spaceId: string;
  spaceKey: string;
  webUrl: string;
  bodyHtml: string;
  updatedAt: string;
};

export interface ConfluenceService {
  fetchPage(pageId: string): Promise<ConfluencePage>;
  validatePage(pageId: string): Promise<ConfluencePage>;
}

type ConfluenceApiPage = {
  id: string;
  title: string;
  version: { number: number; when?: string };
  space?: { id: string; key: string };
  body?: { storage?: { value?: string } };
  _links?: { webui?: string; base?: string };
};

function mapConfluencePage(
  data: ConfluenceApiPage,
  baseUrl: string,
): ConfluencePage {
  const webui =
    data._links?.webui ?? `/pages/viewpage.action?pageId=${data.id}`;
  const base = data._links?.base ?? `${normalizeBaseUrl(baseUrl)}/wiki`;

  return {
    id: data.id,
    title: data.title,
    version: data.version.number,
    spaceId: data.space?.id ?? "",
    spaceKey: data.space?.key ?? "",
    webUrl: `${base}${webui}`,
    bodyHtml: data.body?.storage?.value ?? "",
    updatedAt: data.version.when ?? new Date().toISOString(),
  };
}

export class PublicConfluenceService implements ConfluenceService {
  constructor(private readonly baseUrl: string) {}

  private get apiBase(): string {
    return `${normalizeBaseUrl(this.baseUrl)}/wiki/rest/api`;
  }

  async fetchPage(pageId: string): Promise<ConfluencePage> {
    if (pageId.startsWith("external:")) {
      const token = pageId.slice("external:".length);
      return fetchExternalSharePage({ baseUrl: this.baseUrl, token });
    }

    const url = `${this.apiBase}/content/${pageId}?expand=body.storage,version,space,_links`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      throw new ConfluenceAccessDeniedError(
        `Confluence page ${pageId} is not publicly accessible. Enable anonymous access for this page before adding it as a source.`,
      );
    }

    if (response.status === 404) {
      throw new ConfluenceNotFoundError(
        `Confluence page ${pageId} was not found at ${this.baseUrl}.`,
      );
    }

    if (!response.ok) {
      const text = await response.text();
      throw new ConfluenceApiError(
        `Confluence API error (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as ConfluenceApiPage;
    return mapConfluencePage(data, this.baseUrl);
  }

  async validatePage(pageId: string): Promise<ConfluencePage> {
    return this.fetchPage(pageId);
  }

  async validateExternalUrl(pageUrl: string): Promise<ConfluencePage> {
    const token = parseExternalToken(pageUrl);
    if (!token) {
      throw new ConfluenceApiError("Invalid external Confluence link.");
    }
    return fetchExternalSharePage({ baseUrl: this.baseUrl, token });
  }
}

export class MockConfluenceService implements ConfluenceService {
  private readonly fixturesDir = path.join(
    process.cwd(),
    "fixtures",
    "confluence",
  );

  async fetchPage(pageId: string): Promise<ConfluencePage> {
    const filePath = path.join(this.fixturesDir, `${pageId}.json`);
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as ConfluencePage;
    } catch {
      throw new ConfluenceNotFoundError(
        `Mock Confluence page ${pageId} was not found.`,
      );
    }
  }

  async validatePage(pageId: string): Promise<ConfluencePage> {
    return this.fetchPage(pageId);
  }
}

export class ConfluenceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfluenceNotFoundError";
  }
}

export class ConfluenceAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfluenceAccessDeniedError";
  }
}

export class ConfluenceApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfluenceApiError";
  }
}

export function createConfluenceService(options: {
  mock: boolean;
  baseUrl?: string;
}): ConfluenceService {
  if (options.mock) {
    return new MockConfluenceService();
  }

  if (!options.baseUrl) {
    throw new Error(
      "ATLASSIAN_BASE_URL is required when LOCAL_MOCK_MODE is disabled.",
    );
  }

  return new PublicConfluenceService(options.baseUrl);
}

export { externalPageId, parseExternalToken } from "@/lib/confluence/parse";
