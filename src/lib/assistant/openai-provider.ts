import OpenAI from "openai";
import { dbError, getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  buildRetrievalDiagnostics,
  buildSourceFileMap,
  extractCitedFilesFromAnnotations,
  extractRetrievalResultsFromOutput,
  mapSupportingCitations,
  shouldIncludeCitations,
} from "@/lib/assistant/citations";
import {
  buildInstructionsWithSources,
  DEFAULT_RESPONSE_MAX_OUTPUT_TOKENS,
  formatAssistantAnswer,
  NO_SOURCE_FALLBACK,
} from "@/lib/assistant/prompts";
import type {
  RetrievalChatRequest,
  RetrievalProvider,
  RetrievalStreamEvent,
} from "@/lib/assistant/provider";
import { logError, logInfo } from "@/lib/logger";

export class OpenAIRetrievalProvider implements RetrievalProvider {
  private client: OpenAI;
  private model: string;
  private vectorStoreId: string;

  constructor() {
    const env = getEnv();
    if (!env.OPENAI_API_KEY || !env.OPENAI_VECTOR_STORE_ID) {
      throw new Error("OpenAI is not configured.");
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_MODEL;
    this.vectorStoreId = env.OPENAI_VECTOR_STORE_ID;
  }

  async *streamChat(
    request: RetrievalChatRequest,
  ): AsyncGenerator<RetrievalStreamEvent> {
    const started = Date.now();
    yield { type: "status", status: "retrieving" };

    const { data: sources, error } = await getDb().from("KnowledgeSource").select("id, title, sourceUrl, confluencePageId, spaceKey, lastKnownUpdatedAt, lastKnownVersion, openaiFileId").eq("enabled", true).not("openaiFileId", "is", null);
    if (error) dbError(error, "Unable to load indexed sources");

    const sourceMap = buildSourceFileMap(sources ?? []);
    const instructions = buildInstructionsWithSources(
      Array.from(sourceMap.values()).map((source) => ({
        title: source.title,
        sourceUrl: source.sourceUrl,
      })),
    );

    const input = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const stream = await this.client.responses.create({
        model: this.model,
        instructions,
        input,
        stream: true,
        max_output_tokens: DEFAULT_RESPONSE_MAX_OUTPUT_TOKENS,
        tools: [
          {
            type: "file_search",
            vector_store_ids: [this.vectorStoreId],
          },
        ],
        include: ["file_search_call.results"],
      });

      yield { type: "status", status: "generating" };

      let text = "";
      let openaiResponseId: string | undefined;
      let retrievalCount = 0;
      const citedFiles = new Map<string, { fileId: string; snippet?: string }>();
      let retrievalResults: ReturnType<typeof extractRetrievalResultsFromOutput> =
        [];

      for await (const event of stream) {
        if (event.type === "response.created") {
          openaiResponseId = event.response.id;
        }

        if (event.type === "response.output_text.delta") {
          text += event.delta;
          yield { type: "delta", text: event.delta };
        }

        if (event.type === "response.file_search_call.completed") {
          retrievalCount += 1;
        }

        if (event.type === "response.content_part.done") {
          const part = event.part;
          if (part.type === "output_text" && part.annotations) {
            for (const cited of extractCitedFilesFromAnnotations(
              part.annotations,
            )) {
              citedFiles.set(cited.fileId, cited);
            }
          }
        }

        if (event.type === "response.completed") {
          openaiResponseId = event.response.id;
          retrievalResults = extractRetrievalResultsFromOutput(
            event.response.output,
          );

          for (const item of event.response.output ?? []) {
            if (item.type === "message") {
              for (const content of item.content ?? []) {
                if (content.type === "output_text") {
                  for (const cited of extractCitedFilesFromAnnotations(
                    content.annotations ?? [],
                  )) {
                    citedFiles.set(cited.fileId, cited);
                  }
                }
              }
            }
          }
        }
      }

      if (!text.trim()) {
        text = NO_SOURCE_FALLBACK;
        yield { type: "delta", text };
      }

      const supportingCitations = shouldIncludeCitations(
        text,
        mapSupportingCitations(Array.from(citedFiles.values()), sourceMap),
      );

      text = formatAssistantAnswer(text, supportingCitations);

      const diagnostics = buildRetrievalDiagnostics({
        traceId: request.traceId,
        openaiResponseId,
        retrievalResults,
        citedFiles: Array.from(citedFiles.values()),
        supportingCitations,
      });

      const latencyMs = Date.now() - started;

      logInfo("chat.response.completed", {
        traceId: request.traceId,
        conversationId: request.conversationId,
        openaiRequestId: openaiResponseId,
        latencyMs,
        retrievalCount,
        citationCount: supportingCitations.length,
        retrievedFileIds: diagnostics.retrievedFileIds,
        citedFileIds: diagnostics.citedFileIds,
        supportingSourceIds: diagnostics.supportingSourceIds,
      });

      yield {
        type: "completed",
        text,
        openaiResponseId,
        model: this.model,
        latencyMs,
        retrievalCount,
        citations: supportingCitations,
        diagnostics,
      };
    } catch (error) {
      logError("chat.response.failed", error, {
        traceId: request.traceId,
        conversationId: request.conversationId,
      });
      yield {
        type: "error",
        message: "Unable to generate a response right now. Please try again.",
      };
    }
  }
}

export class OpenAIVectorStoreService {
  private client: OpenAI;

  constructor() {
    const env = getEnv();
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required.");
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async uploadAndAttach(params: {
    filePath: string;
    fileName: string;
    vectorStoreId: string;
  }): Promise<{ fileId: string; indexed: boolean }> {
    const file = await this.client.files.create({
      file: await OpenAI.toFile(
        await import("fs/promises").then((fs) => fs.readFile(params.filePath)),
        params.fileName,
      ),
      purpose: "assistants",
    });

    await this.client.vectorStores.files.create(params.vectorStoreId, {
      file_id: file.id,
    });

    const indexed = await this.pollUntilIndexed(params.vectorStoreId, file.id);
    return { fileId: file.id, indexed };
  }

  async pollUntilIndexed(
    vectorStoreId: string,
    fileId: string,
    maxAttempts = 30,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const status = await this.client.vectorStores.files.retrieve(fileId, {
        vector_store_id: vectorStoreId,
      });
      if (status.status === "completed") return true;
      if (status.status === "failed" || status.status === "cancelled")
        return false;
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  }

  async removeFile(vectorStoreId: string, fileId: string): Promise<void> {
    try {
      await this.client.vectorStores.files.delete(fileId, {
        vector_store_id: vectorStoreId,
      });
      await this.client.files.delete(fileId);
    } catch {
      // Best effort cleanup; stale files are tracked in DB.
    }
  }
}
