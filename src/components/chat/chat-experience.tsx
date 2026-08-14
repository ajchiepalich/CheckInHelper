"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
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
import { ComposerActionIcon } from "@/components/chat/composer-action-icon";
import { cn } from "@/lib/utils";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasInput = input.trim().length > 0;

  function resizeComposer() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 28), 160)}px`;
  }

  useEffect(() => {
    const timers = feedbackHideTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [input]);

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

  const thread = (
    <>
      {showEmptyState ? (
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center">
          <div className="gradient-panel rounded-[1.75rem] p-8 text-white shadow-[var(--shadow-soft)] md:p-10">
            <h3 className="text-4xl font-bold md:text-5xl">How can I help?</h3>
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
        <div className="space-y-6">
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
                  ? "ml-auto w-fit max-w-[min(85%,36rem)]"
                  : "max-w-4xl"
              }
            >
              {message.role === "user" ? (
                <div className="rounded-[1.5rem] bg-[#E8F3FE] px-5 py-3 text-[#0B2749] dark:bg-[#163E75] dark:text-white">
                  <p className="whitespace-pre-wrap break-words text-[15px] font-medium leading-snug">
                    {message.content}
                  </p>
                </div>
              ) : (
                <>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                    Helper
                  </p>
                  <MarkdownContent content={message.content || "…"} />

                  {message.citations && message.citations.length > 0 ? (
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

                  {message.content &&
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
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          aria-label="Helpful"
                          className="rounded-md p-1 text-[var(--color-secondary)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-dark)]"
                          onClick={() =>
                            submitFeedback(message.id, "HELPFUL")
                          }
                        >
                          <ThumbsUp className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Not helpful"
                          className="rounded-md p-1 text-[var(--color-error)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-dark)]"
                          onClick={() =>
                            submitFeedback(message.id, "NOT_HELPFUL")
                          }
                        >
                          <ThumbsDown className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Report incorrect"
                          className="rounded-md p-1 text-[var(--color-gold)] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-dark)]"
                          onClick={() =>
                            submitFeedback(message.id, "INCORRECT")
                          }
                        >
                          <TriangleAlert
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    )
                  ) : null}
                </>
              )}
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
    </>
  );

  const composer = (
    <form
      className="pointer-events-auto w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (!hasInput || isStreaming) return;
        sendMessage(input);
      }}
    >
      <div
        className={cn(
          "composer-glass flex min-h-[56px] w-full items-end gap-1 rounded-[30px] border border-white/25 p-1.5",
          "shadow-[0_8px_28px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.35)]",
          "dark:border-white/12 dark:shadow-[0_8px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.14)]",
        )}
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask Helper
        </label>
        <Textarea
          id="chat-input"
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Helper"
          rows={1}
          disabled={isStreaming}
          className="max-h-40 min-h-[28px] flex-1 resize-none overflow-y-auto border-0 bg-transparent px-3 py-[10px] text-base leading-6 text-[var(--color-foreground)] caret-[#007AFF] shadow-none outline-none ring-0 placeholder:text-[var(--color-muted)]/70 focus:border-0 focus:outline-none focus:ring-0 focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!hasInput || isStreaming) return;
              sendMessage(input);
            }
          }}
        />

        <Button
          type="submit"
          size="icon"
          aria-label={hasInput ? "Send message" : "Ask Helper"}
          disabled={!hasInput || isStreaming}
          className={cn(
            "size-10 shrink-0 overflow-hidden rounded-full bg-[#06354B] p-0 text-[#A5D7F4] hover:bg-[#052c3f] focus-visible:ring-[#06354B]",
            !hasInput && "disabled:opacity-100",
          )}
        >
          {isStreaming ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <ComposerActionIcon
              state={hasInput ? "send" : "idle"}
              className="size-full"
            />
          )}
        </Button>
      </div>
    </form>
  );

  const chatContent = (
    <div
      className={
        embedded
          ? "mx-auto flex h-full min-h-0 w-full max-w-4xl flex-1 flex-col"
          : "grid h-full min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      }
    >
      <section
        aria-label="Conversation"
        className="relative flex h-full min-h-0 flex-col overflow-hidden"
      >
        {!embedded ? (
          <div className="absolute top-4 right-4 z-20 md:top-6 md:right-0">
            <Button variant="outline" onClick={startNewConversation}>
              New conversation
            </Button>
          </div>
        ) : null}

        <div
          className={
            embedded
              ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 pb-28"
              : "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-16 pb-28 md:px-0 md:pt-6"
          }
        >
          {thread}
        </div>

        {/* Overlay dock so thread paints under the glass for backdrop-filter */}
        <div
          className={
            embedded
              ? "pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-6"
              : "pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-6 md:px-0"
          }
        >
          {composer}
        </div>
      </section>

      {!embedded ? (
        <aside
          aria-label="Selected source details"
          className="hidden h-full min-h-0 overflow-y-auto py-6 lg:block"
        >
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
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--color-background)]">
        {chatContent}
      </div>
    );
  }

  return (
    <AppShell contentClassName="flex h-full min-h-0 flex-col overflow-hidden !p-0 md:!px-8">
      {chatContent}
    </AppShell>
  );
}
