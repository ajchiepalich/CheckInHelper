import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEnv, isLocalMockMode } from "@/lib/env";
import { createTraceId, logError } from "@/lib/logger";
import {
  checkRateLimit,
  CHAT_MAX_INPUT_LENGTH,
  sanitizeUserInput,
} from "@/lib/security";
import { createRetrievalProvider } from "@/lib/assistant/mock-provider";
import type { MappedCitation } from "@/lib/assistant/provider";

const chatSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(CHAT_MAX_INPUT_LENGTH),
});

function encodeSse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const traceId = createTraceId();

  try {
    const session = await requireAuth();
    const env = getEnv();

    const rate = checkRateLimit(`chat:${session.user.id}`, env.CHAT_RATE_LIMIT);
    if (!rate.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = chatSchema.parse(await request.json());
    const messageContent = sanitizeUserInput(
      body.message,
      CHAT_MAX_INPUT_LENGTH,
    );

    let conversationId = body.conversationId;
    if (conversationId) {
      const existing = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: session.user.id },
      });
      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Conversation not found." }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    } else {
      const created = await prisma.conversation.create({
        data: {
          userId: session.user.id,
          title: messageContent.slice(0, 80),
        },
      });
      conversationId = created.id;
    }

    await prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content: messageContent,
      },
    });

    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });

    const provider = await createRetrievalProvider(isLocalMockMode());

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let assistantText = "";
        let completion:
          | {
              openaiResponseId?: string;
              model: string;
              latencyMs: number;
              retrievalCount: number;
              citations: MappedCitation[];
            }
          | undefined;

        controller.enqueue(
          encoder.encode(
            encodeSse({
              type: "conversation",
              conversationId,
              traceId,
            }),
          ),
        );

        try {
          for await (const event of provider.streamChat({
            messages: history.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            traceId,
            conversationId,
          })) {
            if (event.type === "status") {
              controller.enqueue(encoder.encode(encodeSse(event)));
            } else if (event.type === "delta") {
              assistantText += event.text;
              controller.enqueue(encoder.encode(encodeSse(event)));
            } else if (event.type === "completed") {
              assistantText = event.text;
              completion = {
                openaiResponseId: event.openaiResponseId,
                model: event.model,
                latencyMs: event.latencyMs,
                retrievalCount: event.retrievalCount,
                citations: event.citations,
              };
              controller.enqueue(encoder.encode(encodeSse(event)));
            } else if (event.type === "error") {
              controller.enqueue(encoder.encode(encodeSse(event)));
            }
          }

          if (completion) {
            const assistantMessage = await prisma.message.create({
              data: {
                conversationId,
                role: "assistant",
                content: assistantText,
                openaiResponseId: completion.openaiResponseId,
                model: completion.model,
                latencyMs: completion.latencyMs,
                retrievalCount: completion.retrievalCount,
              },
            });

            if (completion.citations.length > 0) {
              await prisma.messageCitation.createMany({
                data: completion.citations.map((c) => ({
                  messageId: assistantMessage.id,
                  knowledgeSourceId: c.knowledgeSourceId,
                  openaiFileId: c.openaiFileId,
                  title: c.title,
                  sourceUrl: c.sourceUrl,
                  confluencePageId: c.confluencePageId,
                  spaceKey: c.spaceKey,
                  confluenceUpdatedAt: c.confluenceUpdatedAt
                    ? new Date(c.confluenceUpdatedAt)
                    : undefined,
                })),
              });
            }

            await prisma.conversation.update({
              where: { id: conversationId },
              data: { updatedAt: new Date() },
            });

            controller.enqueue(
              encoder.encode(
                encodeSse({
                  type: "saved",
                  messageId: assistantMessage.id,
                  citations: completion.citations,
                }),
              ),
            );
          }
        } catch (error) {
          logError("chat.stream.failed", error, {
            traceId,
            conversationId,
            userId: session.user.id,
          });
          controller.enqueue(
            encoder.encode(
              encodeSse({
                type: "error",
                message: "Something went wrong while generating a response.",
              }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: "Invalid chat request." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    logError("chat.request.failed", error, { traceId });
    return new Response(
      JSON.stringify({ error: "Unable to process chat request." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
