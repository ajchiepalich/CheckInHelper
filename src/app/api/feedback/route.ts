import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FeedbackHelpful } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEEDBACK_MAX_COMMENT_LENGTH } from "@/lib/security";

const feedbackSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  helpful: z.nativeEnum(FeedbackHelpful),
  reason: z.string().max(200).optional(),
  comments: z.string().max(FEEDBACK_MAX_COMMENT_LENGTH).optional(),
  suggestsDocumentationGap: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = feedbackSchema.parse(await request.json());

    const message = await prisma.message.findFirst({
      where: {
        id: body.messageId,
        conversationId: body.conversationId,
        conversation: { userId: session.user.id },
        role: "assistant",
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message not found." },
        { status: 404 },
      );
    }

    const feedback = await prisma.answerFeedback.create({
      data: {
        userId: session.user.id,
        conversationId: body.conversationId,
        messageId: body.messageId,
        helpful: body.helpful,
        reason: body.reason,
        comments: body.comments,
        suggestsDocumentationGap:
          body.suggestsDocumentationGap ??
          (body.helpful === FeedbackHelpful.NOT_HELPFUL ||
            body.helpful === FeedbackHelpful.INCORRECT),
      },
    });

    return NextResponse.json({ id: feedback.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid feedback payload." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Unable to submit feedback." },
      { status: 500 },
    );
  }
}
