import type { MappedCitation } from "@/lib/assistant/provider";
import { NO_SOURCE_FALLBACK } from "@/lib/assistant/prompts";

export type CitedFileAnnotation = {
  fileId: string;
  snippet?: string;
};

export type RetrievedFileResult = {
  fileId: string;
  score?: number;
  snippet?: string;
};

export type RetrievalDiagnostics = {
  traceId: string;
  openaiResponseId?: string;
  retrievedFileIds: string[];
  retrievalResults: RetrievedFileResult[];
  citedFileIds: string[];
  supportingSourceIds: string[];
  citationMappings: Array<{
    fileId: string;
    knowledgeSourceId?: string;
    title: string;
    sourceUrl: string;
  }>;
};

export function buildSourceFileMap(
  sources: Array<{
    id: string;
    title: string;
    sourceUrl: string;
    confluencePageId: string;
    spaceKey: string | null;
    lastKnownUpdatedAt: Date | null;
    lastKnownVersion: number | null;
    openaiFileId: string | null;
  }>,
): Map<string, MappedCitation> {
  const sourceMap = new Map<string, MappedCitation>();

  for (const source of sources) {
    if (!source.openaiFileId) continue;
    sourceMap.set(source.openaiFileId, {
      openaiFileId: source.openaiFileId,
      title: source.title,
      sourceUrl: source.sourceUrl,
      confluencePageId: source.confluencePageId,
      confluenceVersion: source.lastKnownVersion ?? undefined,
      spaceKey: source.spaceKey ?? undefined,
      confluenceUpdatedAt: source.lastKnownUpdatedAt?.toISOString(),
      knowledgeSourceId: source.id,
    });
  }

  return sourceMap;
}

export function mapSupportingCitations(
  citedFiles: CitedFileAnnotation[],
  sourceMap: Map<string, MappedCitation>,
): MappedCitation[] {
  const seen = new Set<string>();
  const citations: MappedCitation[] = [];

  for (const cited of citedFiles) {
    if (seen.has(cited.fileId)) continue;

    const mapped = sourceMap.get(cited.fileId);
    if (!mapped) continue;

    seen.add(cited.fileId);
    citations.push({
      ...mapped,
      snippet: cited.snippet?.trim() || undefined,
    });
  }

  return citations;
}

export function buildRetrievalDiagnostics(params: {
  traceId: string;
  openaiResponseId?: string;
  retrievalResults: RetrievedFileResult[];
  citedFiles: CitedFileAnnotation[];
  supportingCitations: MappedCitation[];
}): RetrievalDiagnostics {
  return {
    traceId: params.traceId,
    openaiResponseId: params.openaiResponseId,
    retrievedFileIds: params.retrievalResults.map((result) => result.fileId),
    retrievalResults: params.retrievalResults,
    citedFileIds: params.citedFiles.map((cited) => cited.fileId),
    supportingSourceIds: params.supportingCitations
      .map((citation) => citation.knowledgeSourceId)
      .filter((id): id is string => Boolean(id)),
    citationMappings: params.supportingCitations.map((citation) => ({
      fileId: citation.openaiFileId ?? "",
      knowledgeSourceId: citation.knowledgeSourceId,
      title: citation.title,
      sourceUrl: citation.sourceUrl,
    })),
  };
}

export function shouldIncludeCitations(
  answerText: string,
  citations: MappedCitation[],
): MappedCitation[] {
  if (!answerText.trim() || citations.length === 0) {
    return [];
  }

  if (answerText.includes(NO_SOURCE_FALLBACK)) {
    return [];
  }

  return citations;
}

export function extractCitedFilesFromAnnotations(
  annotations: Array<{ type?: string; file_id?: string; quote?: string; text?: string }>,
): CitedFileAnnotation[] {
  const cited: CitedFileAnnotation[] = [];

  for (const annotation of annotations) {
    if (annotation.type !== "file_citation" || !annotation.file_id) continue;
    cited.push({
      fileId: annotation.file_id,
      snippet: annotation.quote ?? annotation.text,
    });
  }

  return cited;
}

export function extractRetrievalResultsFromOutput(
  output: unknown,
): RetrievedFileResult[] {
  const results: RetrievedFileResult[] = [];

  if (!Array.isArray(output)) return results;

  for (const item of output) {
    if (
      typeof item === "object" &&
      item &&
      "type" in item &&
      item.type === "file_search_call" &&
      "results" in item &&
      Array.isArray(item.results)
    ) {
      for (const result of item.results) {
        if (typeof result !== "object" || !result || !("file_id" in result)) {
          continue;
        }

        results.push({
          fileId: String(result.file_id),
          score:
            "score" in result && typeof result.score === "number"
              ? result.score
              : undefined,
          snippet:
            "text" in result && typeof result.text === "string"
              ? result.text
              : undefined,
        });
      }
    }
  }

  return results;
}
