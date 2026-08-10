import { readFile } from "fs/promises";
import path from "path";

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

export type ConfluenceClientConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

export interface ConfluenceService {
  fetchPage(pageId: string): Promise<ConfluencePage>;
  validatePage(pageId: string): Promise<ConfluencePage>;
}

function authHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

export class AtlassianConfluenceService implements ConfluenceService {
  constructor(private readonly config: ConfluenceClientConfig) {}

  private get apiBase(): string {
    return `${this.config.baseUrl.replace(/\/$/, "")}/wiki/rest/api`;
  }

  async fetchPage(pageId: string): Promise<ConfluencePage> {
    const url = `${this.apiBase}/content/${pageId}?expand=body.storage,version,space,_links`;
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader(this.config.email, this.config.apiToken),
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      throw new ConfluenceNotFoundError(
        `Confluence page ${pageId} was not found.`,
      );
    }

    if (!response.ok) {
      const text = await response.text();
      throw new ConfluenceApiError(
        `Confluence API error (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      id: string;
      title: string;
      version: { number: number; when?: string };
      space?: { id: string; key: string };
      body?: { storage?: { value?: string } };
      _links?: { webui?: string; base?: string };
    };

    const webui =
      data._links?.webui ?? `/pages/viewpage.action?pageId=${data.id}`;
    const base =
      data._links?.base ?? `${this.config.baseUrl.replace(/\/$/, "")}/wiki`;

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

  async validatePage(pageId: string): Promise<ConfluencePage> {
    return this.fetchPage(pageId);
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

export class ConfluenceApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfluenceApiError";
  }
}

export function createConfluenceService(options: {
  mock: boolean;
  baseUrl?: string;
  email?: string;
  apiToken?: string;
}): ConfluenceService {
  if (options.mock) {
    return new MockConfluenceService();
  }

  if (!options.baseUrl || !options.email || !options.apiToken) {
    throw new Error(
      "Confluence credentials are required when mock mode is disabled.",
    );
  }

  return new AtlassianConfluenceService({
    baseUrl: options.baseUrl,
    email: options.email,
    apiToken: options.apiToken,
  });
}
