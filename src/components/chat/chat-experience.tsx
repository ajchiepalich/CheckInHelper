"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Send,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { SUGGESTED_PROMPTS } from "@/lib/assistant/prompts";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MarkdownContent } from "@/components/chat/markdown-content";
import {
  CitationCard,
  type CitationView,
} from "@/components/chat/citation-card";
import { Card } from "@/components/ui/card";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationView[];
};

export function ChatExperience({
  initialConversationId,
  embedded = false,
}: {
  initialConversationId?: string;
  embedded?: boolean;
}) {
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<CitationView | null>(
    null,
  );
  const [feedbackByMessage, setFeedbackByMessage] = useState<
    Record<string, "confirming" | "hidden">
  >({});
  const feedbackHideTimers = useRef<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers = feedbackHideTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setIsStreaming(true);
    setStatus("Sending your question…");

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", citations: [] },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: trimmed }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; traceId?: string }
          | null;
        throw new Error(
          payload?.traceId
            ? `${payload.error ?? "Unable to reach the assistant."} Reference: ${payload.traceId}`
            : (payload?.error ?? "Unable to reach the assistant."),
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            type: string;
            conversationId?: string;
            text?: string;
            status?: string;
            message?: string;
            citations?: CitationView[];
            messageId?: string;
          };

          if (payload.type === "conversation" && payload.conversationId) {
            setConversationId(payload.conversationId);
          } else if (payload.type === "status" && payload.status) {
            setStatus(
              payload.status === "retrieving"
                ? "Searching approved documentation…"
                : payload.status === "generating"
                  ? "Preparing your answer…"
                  : null,
            );
          } else if (payload.type === "delta" && payload.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + payload.text }
                  : m,
              ),
            );
          } else if (payload.type === "completed") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                    ...m,
                    content: payload.text ?? m.content,
                    citations: payload.citations ?? [],
                    id: payload.messageId ?? assistantId,
                  }
                  : m,
              ),
            );
          } else if (payload.type === "saved") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                    ...m,
                    id: payload.messageId ?? assistantId,
                    citations: payload.citations ?? m.citations,
                  }
                  : m,
              ),
            );
          } else if (payload.type === "error") {
            setError(payload.message ?? "Something went wrong.");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
      setStatus(null);
    }
  }

  async function submitFeedback(
    messageId: string,
    helpful: "HELPFUL" | "NOT_HELPFUL" | "INCORRECT",
  ) {
    if (!conversationId || feedbackByMessage[messageId]) return;

    setFeedbackByMessage((prev) => ({ ...prev, [messageId]: "confirming" }));

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messageId,
          helpful,
          suggestsDocumentationGap: helpful !== "HELPFUL",
        }),
      });
    } catch {
      // Keep the confirmation UI even if the request fails so the row still clears.
    }

    if (feedbackHideTimers.current[messageId]) {
      window.clearTimeout(feedbackHideTimers.current[messageId]);
    }
    feedbackHideTimers.current[messageId] = window.setTimeout(() => {
      setFeedbackByMessage((prev) => ({ ...prev, [messageId]: "hidden" }));
      delete feedbackHideTimers.current[messageId];
    }, 1400);
  }

  function startNewConversation() {
    Object.values(feedbackHideTimers.current).forEach((timer) =>
      window.clearTimeout(timer),
    );
    feedbackHideTimers.current = {};
    setConversationId(undefined);
    setMessages([]);
    setSelectedCitation(null);
    setError(null);
    setFeedbackByMessage({});
  }

  const showEmptyState = messages.length === 0;

  const chatContent = (
    <div
      className={
        embedded
          ? "mx-auto flex h-full min-h-[100dvh] max-w-4xl flex-col px-4 py-4"
          : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      }
    >
      <section
        aria-label="Conversation"
        className={embedded ? "flex flex-1 flex-col" : "flex min-h-[70vh] flex-col"}
      >
        {!embedded ? (
          <div className="mb-4 flex justify-end">
            <Button variant="outline" onClick={startNewConversation}>
              New conversation
            </Button>
          </div>
        ) : null}

        {showEmptyState ? (
          <div
            className={
              embedded
                ? "flex flex-1 flex-col justify-center"
                : undefined
            }
          >
            <div className="gradient-panel rounded-[1.75rem] p-8 text-white shadow-[var(--shadow-soft)] md:p-10">
              <h3 className="text-4xl font-bold md:text-5xl">
                How can I help?
              </h3>
              <div className="mt-8 grid gap-3 md:grid-cols-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="rounded-2xl bg-white/15 p-4 text-left text-sm font-medium backdrop-blur transition hover:bg-white/25"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            {messages.map((message) => (
              <article
                key={message.id}
                aria-live={
                  message.role === "assistant" && isStreaming
                    ? "polite"
                    : undefined
                }
                className={
                  message.role === "user"
                    ? "ml-auto max-w-3xl rounded-2xl bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-soft)]"
                    : "max-w-4xl"
                }
              >
                <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                  {message.role === "user"
                    ? "You"
                    : "Documentation assistant"}
                </p>
                {message.role === "assistant" ? (
                  <MarkdownContent content={message.content || "…"} />
                ) : (
                  <p className="whitespace-pre-wrap text-[var(--color-foreground)]">
                    {message.content}
                  </p>
                )}

                {message.role === "assistant" &&
                  message.citations &&
                  message.citations.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    <h4 className="text-sm font-semibold text-[var(--color-primary)]">
                      Sources
                    </h4>
                    <div className="grid gap-3">
                      {message.citations.map((citation, index) => (
                        <CitationCard
                          key={`${message.id}-${index}`}
                          citation={citation}
                          onSelect={setSelectedCitation}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {message.role === "assistant" &&
                  message.content &&
                  !message.id.startsWith("local-") &&
                  feedbackByMessage[message.id] !== "hidden" ? (
                  feedbackByMessage[message.id] === "confirming" ? (
                    <div
                      className="feedback-confirm mt-4 flex items-center gap-2 text-sm font-medium text-[var(--color-primary-dark)]"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="feedback-confirm-icon inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-success-bg)]">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                      Thanks for your feedback
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => submitFeedback(message.id, "HELPFUL")}
                      >
                        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                        Helpful
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          submitFeedback(message.id, "NOT_HELPFUL")
                        }
                      >
                        <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                        Not helpful
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          submitFeedback(message.id, "INCORRECT")
                        }
                      >
                        <TriangleAlert
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        Report incorrect
                      </Button>
                    </div>
                  )
                ) : null}
              </article>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {status ? (
          <p
            className="mt-4 flex items-center gap-2 text-sm text-[var(--color-muted)]"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {status}
          </p>
        ) : null}

        {error ? (
          <Card className="mt-4 border-[var(--color-error)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error)]">
            {error}
          </Card>
        ) : null}

        <form
          className="sticky bottom-0 mt-6 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <label htmlFor="chat-input" className="sr-only">
            Ask a documentation question
          </label>
          <Textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a process, system, or policy…"
            rows={3}
            disabled={isStreaming}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--color-muted)]">
              Answers are based on approved Highlands documentation. Press
              Enter to send, Shift+Enter for a new line.
            </p>
            <Button type="submit" disabled={isStreaming || !input.trim()}>
              {isStreaming ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              Send
            </Button>
          </div>
        </form>
      </section>

      {!embedded ? (
        <aside aria-label="Selected source details" className="hidden lg:block">
          <Card className="sticky top-6 p-6">
            <h3 className="text-lg font-semibold text-[var(--color-primary)]">
              Source details
            </h3>
            {selectedCitation ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="font-semibold">{selectedCitation.title}</p>
                <p className="text-[var(--color-muted)]">
                  {selectedCitation.spaceKey
                    ? `Space ${selectedCitation.spaceKey}`
                    : "Confluence source"}
                </p>
                <a
                  href={selectedCitation.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex font-medium text-[var(--color-secondary)] underline"
                >
                  Open in Confluence
                </a>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--color-muted)]">
                Select a citation to preview the source details here.
              </p>
            )}
          </Card>
        </aside>
      ) : null}
    </div>
  );

  if (embedded) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-background)]">
        {chatContent}
      </div>
    );
  }

  return <AppShell>{chatContent}</AppShell>;
}
