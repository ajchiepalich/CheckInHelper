import TurndownService from "turndown";
// @ts-expect-error no types published for plugin
import { gfm } from "turndown-plugin-gfm";

export type MarkdownConversionResult = {
  markdown: string;
  warnings: string[];
};

function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<ac:structured-macro[\s\S]*?<\/ac:structured-macro>/gi,
      (match) => {
        const nameMatch = match.match(/ac:name="([^"]+)"/);
        const macroName = nameMatch?.[1] ?? "unknown";
        if (["info", "note", "warning", "tip"].includes(macroName)) {
          const bodyMatch = match.match(
            /<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/,
          );
          return bodyMatch?.[1] ?? `[Unsupported macro: ${macroName}]`;
        }
        return `[Unsupported macro: ${macroName}]`;
      },
    )
    .replace(/<ac:parameter[\s\S]*?<\/ac:parameter>/gi, "")
    .replace(/<ac:plain-text-body>([\s\S]*?)<\/ac:plain-text-body>/gi, "$1");
}

export function convertConfluenceHtmlToMarkdown(
  html: string,
): MarkdownConversionResult {
  const warnings: string[] = [];

  if (!html || html.trim().length === 0) {
    warnings.push("Empty HTML body received from Confluence.");
    return { markdown: "", warnings };
  }

  if (html.includes("ac:structured-macro")) {
    warnings.push("One or more Confluence macros were simplified or flagged.");
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  turndown.use(gfm);

  turndown.addRule("preserveLinks", {
    filter: "a",
    replacement(content, node) {
      const element = node as HTMLAnchorElement;
      const href = element.getAttribute("href") ?? "";
      const title = element.getAttribute("title");
      if (!href) return content;
      return title
        ? `[${content}](${href} "${title}")`
        : `[${content}](${href})`;
    },
  });

  const cleaned = stripNoise(html);
  let markdown = turndown.turndown(cleaned);

  markdown = markdown
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  if (!markdown) {
    warnings.push("Conversion produced empty markdown.");
  }

  return { markdown, warnings };
}

export type MarkdownFrontmatter = {
  confluencePageId: string;
  title: string;
  sourceUrl: string;
  spaceId?: string;
  spaceKey?: string;
  version: number;
  category?: string;
  audience?: string;
  classification?: string;
  confluenceUpdatedAt: string;
  indexedAt: string;
};

export function buildMarkdownDocument(
  frontmatter: MarkdownFrontmatter,
  body: string,
): string {
  const fm = [
    "---",
    `confluence_page_id: "${frontmatter.confluencePageId}"`,
    `title: "${frontmatter.title.replace(/"/g, '\\"')}"`,
    `source_url: "${frontmatter.sourceUrl}"`,
    frontmatter.spaceId ? `space_id: "${frontmatter.spaceId}"` : null,
    frontmatter.spaceKey ? `space_key: "${frontmatter.spaceKey}"` : null,
    `version: ${frontmatter.version}`,
    frontmatter.category ? `category: "${frontmatter.category}"` : null,
    frontmatter.audience ? `audience: "${frontmatter.audience}"` : null,
    frontmatter.classification
      ? `classification: "${frontmatter.classification}"`
      : null,
    `confluence_updated_at: "${frontmatter.confluenceUpdatedAt}"`,
    `indexed_at: "${frontmatter.indexedAt}"`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const sourceSection = `\n\n## Source\n\n[Open the original Confluence page](${frontmatter.sourceUrl})\n`;

  return `${fm}\n\n# ${frontmatter.title}\n\n${body.trim()}${sourceSection}`;
}
