import { describe, expect, it } from "vitest";
import { MockRetrievalProvider } from "@/lib/assistant/mock-provider";

describe("MockRetrievalProvider", () => {
  it("streams citations for support questions", async () => {
    const provider = new MockRetrievalProvider();
    const events = [];
    for await (const event of provider.streamChat({
      messages: [
        { role: "user", content: "How do I request technology support?" },
      ],
      traceId: "trace-1",
      conversationId: "conv-1",
    })) {
      events.push(event);
    }

    const completed = events.find((event) => event.type === "completed");
    expect(completed?.type).toBe("completed");
    if (completed?.type === "completed") {
      expect(completed.citations.length).toBeGreaterThan(0);
      expect(completed.text).toContain("technology support");
    }
  });

  it("returns fallback when no source matches", async () => {
    const provider = new MockRetrievalProvider();
    let text = "";
    for await (const event of provider.streamChat({
      messages: [{ role: "user", content: "What is the cafeteria menu?" }],
      traceId: "trace-2",
      conversationId: "conv-2",
    })) {
      if (event.type === "completed") text = event.text;
    }
    expect(text).toContain("approved Highlands documentation");
  });
});
