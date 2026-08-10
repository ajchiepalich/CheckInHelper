import type { KnowledgeSource } from "@prisma/client";
import { hashContent } from "@/lib/logger";

export type SourceChangeDetection = {
  changed: boolean;
  reason: "new" | "version" | "hash" | "unchanged";
};

export function detectSourceChange(
  source: Pick<
    KnowledgeSource,
    "lastKnownVersion" | "contentHash" | "openaiFileId"
  >,
  currentVersion: number,
  markdownContent: string,
): SourceChangeDetection {
  const nextHash = hashContent(markdownContent);

  if (
    !source.openaiFileId ||
    source.lastKnownVersion == null ||
    !source.contentHash
  ) {
    return { changed: true, reason: "new" };
  }

  if (source.lastKnownVersion !== currentVersion) {
    return { changed: true, reason: "version" };
  }

  if (source.contentHash !== nextHash) {
    return { changed: true, reason: "hash" };
  }

  return { changed: false, reason: "unchanged" };
}

export { hashContent };
