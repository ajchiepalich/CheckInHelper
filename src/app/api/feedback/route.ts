import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FeedbackHelpful, dbError, getDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
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

    const { data: conversation, error: conversationError } = await getDb().from("Conversation").select("id").eq("id", body.conversationId).eq("userId", session.user.id).maybeSingle();
    if (conversationError) dbError(conversationError, "Unable to load conversation");
    const { data: message, error: messageError } = await getDb().from("Message").select("id").eq("id", body.messageId).eq("conversationId", body.conversationId).eq("role", "assistant").maybeSingle();
    if (messageError) dbError(messageError, "Unable to load message");

    if (!conversation || !message) {
      return NextResponse.json(
        { error: "Message not found." },
        { status: 404 },
      );
    }

    const { data: feedback, error } = await getDb().from("AnswerFeedback").insert({
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
    }).select("id").single();
    if (error || !feedback) dbError(error, "Unable to save feedback");

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
