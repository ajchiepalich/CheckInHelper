import type {
  MappedCitation,
  RetrievalChatRequest,
  RetrievalProvider,
  RetrievalStreamEvent,
} from "@/lib/assistant/provider";
import { NO_SOURCE_FALLBACK } from "@/lib/assistant/prompts";
import { logInfo } from "@/lib/logger";

const MOCK_RESPONSES: Record<
  string,
  { text: string; citations: MappedCitation[] }
> = {
  default: {
    text: `Based on the approved Highlands documentation, you can request technology support by submitting a ticket through the IT Service Portal.

**Steps:**
1. Open the IT Service Portal from the staff intranet.
2. Choose **Request Technology Support**.
3. Describe the issue and any affected systems.
4. Submit the request and note your ticket number.

If the issue is urgent and affects ministry operations, follow the escalation guidance in the source document.`,
    citations: [
      {
        title: "Requesting Technology Support",
        sourceUrl: "https://highlands.atlassian.net/wiki/spaces/IT/pages/10001",
        confluencePageId: "10001",
        spaceKey: "IT",
        confluenceUpdatedAt: "2026-07-01T12:00:00.000Z",
        knowledgeSourceId: "mock-source-1",
        openaiFileId: "file-mock-1",
        snippet: "Submit a ticket through the IT Service Portal.",
      },
    ],
  },
  access: {
    text: `System access requests are documented in the Highlands access management process.

**Typical steps:**
1. Confirm your role requires the system.
2. Submit an access request with your manager's approval.
3. IT Security reviews and provisions access.
4. You receive confirmation when access is granted.

Access is granted only for documented business needs.`,
    citations: [
      {
        title: "System Access Requests",
        sourceUrl: "https://highlands.atlassian.net/wiki/spaces/IT/pages/10002",
        confluencePageId: "10002",
        spaceKey: "IT",
        confluenceUpdatedAt: "2026-06-15T09:00:00.000Z",
        knowledgeSourceId: "mock-source-2",
        openaiFileId: "file-mock-2",
      },
    ],
  },
  rock: {
    text: `Rock RMS documentation is maintained in the Ministry Systems space.

Look for guides on check-in, groups, workflows, and reporting. Start with the Rock RMS Overview page and follow links to the area you need.`,
    citations: [
      {
        title: "Rock RMS Overview",
        sourceUrl:
          "https://highlands.atlassian.net/wiki/spaces/MIN/pages/10003",
        confluencePageId: "10003",
        spaceKey: "MIN",
        confluenceUpdatedAt: "2026-05-20T14:00:00.000Z",
        knowledgeSourceId: "mock-source-3",
        openaiFileId: "file-mock-3",
      },
    ],
  },
  unknown: {
    text: NO_SOURCE_FALLBACK,
    citations: [],
  },
};

function pickMockResponse(question: string) {
  const q = question.toLowerCase();
  if (q.includes("technology support") || q.includes("it support")) {
    return MOCK_RESPONSES.default;
  }
  if (q.includes("access")) {
    return MOCK_RESPONSES.access;
  }
  if (q.includes("rock")) {
    return MOCK_RESPONSES.rock;
  }
  if (q.includes("not working") || q.includes("broken")) {
    return {
      text: `When a documented process is not working:

1. Verify you are following the latest documented steps.
2. Capture screenshots or error messages.
3. Submit a technology support request with the process name and where it failed.
4. Escalate through your campus or ministry leader if ministry operations are impacted.

Do not work around security or approval requirements unless documented.`,
      citations: MOCK_RESPONSES.default.citations,
    };
  }
  return MOCK_RESPONSES.unknown;
}

export class MockRetrievalProvider implements RetrievalProvider {
  async *streamChat(
    request: RetrievalChatRequest,
  ): AsyncGenerator<RetrievalStreamEvent> {
    const started = Date.now();
    const lastUser = [...request.messages]
      .reverse()
      .find((m) => m.role === "user");
    const question = lastUser?.content ?? "";

    yield { type: "status", status: "retrieving" };
    await delay(300);
    yield { type: "status", status: "generating" };

    const mock = pickMockResponse(question);
    const words = mock.text.split(/(\s+)/);

    for (const chunk of words) {
      await delay(20);
      yield { type: "delta", text: chunk };
    }

    const latencyMs = Date.now() - started;

    logInfo("mock.chat.completed", {
      traceId: request.traceId,
      conversationId: request.conversationId,
      latencyMs,
      citationCount: mock.citations.length,
    });

    yield {
      type: "completed",
      text: mock.text,
      openaiResponseId: `mock-${request.traceId}`,
      model: "mock-model",
      latencyMs,
      retrievalCount: mock.citations.length > 0 ? 1 : 0,
      citations: mock.citations,
    };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createRetrievalProvider(
  useMock: boolean,
): Promise<RetrievalProvider> {
  if (useMock) {
    return new MockRetrievalProvider();
  }
  const { OpenAIRetrievalProvider } =
    await import("@/lib/assistant/openai-provider");
  return new OpenAIRetrievalProvider();
}
