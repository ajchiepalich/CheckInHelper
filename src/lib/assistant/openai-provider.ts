import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import {
  DEFAULT_RESPONSE_MAX_OUTPUT_TOKENS,
  NO_SOURCE_FALLBACK,
  SYSTEM_PROMPT,
} from "@/lib/assistant/prompts";
import type {
  MappedCitation,
  RetrievalChatRequest,
  RetrievalProvider,
  RetrievalStreamEvent,
} from "@/lib/assistant/provider";
import { logError, logInfo } from "@/lib/logger";

function mapFileToCitation(
  fileId: string,
  sourceMap: Map<string, MappedCitation>,
): MappedCitation {
  const mapped = sourceMap.get(fileId);
  if (mapped) return mapped;
  return {
    openaiFileId: fileId,
    title: "Documentation source",
    sourceUrl: "#",
  };
}

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

    const sources = await prisma.knowledgeSource.findMany({
      where: { enabled: true, openaiFileId: { not: null } },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        confluencePageId: true,
        spaceKey: true,
        lastKnownUpdatedAt: true,
        openaiFileId: true,
      },
    });

    const sourceMap = new Map<string, MappedCitation>();
    for (const source of sources) {
      if (!source.openaiFileId) continue;
      sourceMap.set(source.openaiFileId, {
        openaiFileId: source.openaiFileId,
        title: source.title,
        sourceUrl: source.sourceUrl,
        confluencePageId: source.confluencePageId,
        spaceKey: source.spaceKey ?? undefined,
        confluenceUpdatedAt: source.lastKnownUpdatedAt?.toISOString(),
        knowledgeSourceId: source.id,
      });
    }

    const input = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const stream = await this.client.responses.create({
        model: this.model,
        instructions: SYSTEM_PROMPT,
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
      const citationFileIds = new Set<string>();

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
            for (const annotation of part.annotations) {
              if (annotation.type === "file_citation") {
                citationFileIds.add(annotation.file_id);
              }
            }
          }
        }

        if (event.type === "response.completed") {
          openaiResponseId = event.response.id;
          for (const item of event.response.output ?? []) {
            if (item.type === "message") {
              for (const content of item.content ?? []) {
                if (content.type === "output_text") {
                  for (const annotation of content.annotations ?? []) {
                    if (annotation.type === "file_citation") {
                      citationFileIds.add(annotation.file_id);
                    }
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

      const citations = Array.from(citationFileIds).map((fileId) =>
        mapFileToCitation(fileId, sourceMap),
      );

      const latencyMs = Date.now() - started;

      logInfo("chat.response.completed", {
        traceId: request.traceId,
        conversationId: request.conversationId,
        openaiRequestId: openaiResponseId,
        latencyMs,
        retrievalCount,
        citationCount: citations.length,
      });

      yield {
        type: "completed",
        text,
        openaiResponseId,
        model: this.model,
        latencyMs,
        retrievalCount,
        citations,
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
