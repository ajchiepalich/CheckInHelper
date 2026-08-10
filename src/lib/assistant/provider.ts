export type MappedCitation = {
  openaiFileId?: string;
  title: string;
  sourceUrl: string;
  confluencePageId?: string;
  spaceKey?: string;
  confluenceUpdatedAt?: string;
  knowledgeSourceId?: string;
};

export type ChatMessageInput = {
  role: "user" | "assistant";
  content: string;
};

export type RetrievalChatRequest = {
  messages: ChatMessageInput[];
  traceId: string;
  conversationId: string;
};

export type RetrievalStreamEvent =
  | {
      type: "status";
      status: "retrieving" | "generating" | "completed" | "error";
    }
  | { type: "delta"; text: string }
  | {
      type: "completed";
      text: string;
      openaiResponseId?: string;
      model: string;
      latencyMs: number;
      retrievalCount: number;
      citations: MappedCitation[];
    }
  | { type: "error"; message: string };

export interface RetrievalProvider {
  streamChat(
    request: RetrievalChatRequest,
  ): AsyncGenerator<RetrievalStreamEvent>;
}
