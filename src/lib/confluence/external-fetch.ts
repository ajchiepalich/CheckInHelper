import { chromium } from "playwright";
import type { ConfluencePage } from "@/lib/confluence/service";
import {
  buildExternalShareUrl,
  externalPageId,
} from "@/lib/confluence/parse";

export { externalPageId };

export async function fetchExternalSharePage(params: {
  baseUrl: string;
  token: string;
}): Promise<ConfluencePage> {
  const sourceUrl = buildExternalShareUrl(params.baseUrl, params.token);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(sourceUrl, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForTimeout(2_000);

    const rendered = await page.evaluate(() => {
      const title =
        document.querySelector("h1")?.textContent?.trim() ||
        document.title.replace(/\s+-?\s*Highlands.*$/i, "").trim() ||
        "Shared Confluence page";
      const contentRoot =
        document.querySelector(
          "#main-content, [data-testid='content-body'], .wiki-content, .ak-renderer-document",
        ) ?? document.querySelector("main");
      return {
        title,
        bodyHtml: contentRoot?.innerHTML ?? "",
        textLength: contentRoot?.textContent?.trim().length ?? 0,
      };
    });

    if (!rendered.bodyHtml || rendered.textLength < 20) {
      throw new Error(
        "Unable to read public content from the external Confluence link. Confirm the page is publicly shared.",
      );
    }

    return {
      id: externalPageId(params.token),
      title: rendered.title,
      version: 1,
      spaceId: "",
      spaceKey: "PUBLIC",
      webUrl: sourceUrl,
      bodyHtml: rendered.bodyHtml,
      updatedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}
