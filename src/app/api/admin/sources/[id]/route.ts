import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { AuditEventType, dbError, getDb } from "@/lib/db";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  category: z.string().optional(),
  audience: z.string().optional(),
  classification: z.string().optional(),
  title: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());

    const { data: source, error: sourceError } = await getDb().from("KnowledgeSource").update(body).eq("id", id).select("*").single();
    if (sourceError || !source) dbError(sourceError, "Unable to update source");

    if (body.enabled !== undefined) {
      const { error } = await getDb().from("AuditEvent").insert({
        type: body.enabled
          ? AuditEventType.SOURCE_ENABLED
          : AuditEventType.SOURCE_DISABLED,
        userId: session.user.id,
        entityType: "KnowledgeSource",
        entityId: id,
      });
      if (error) dbError(error, "Unable to record audit event");
    } else {
      const { error } = await getDb().from("AuditEvent").insert({
        type: AuditEventType.SOURCE_UPDATED,
        userId: session.user.id,
        entityType: "KnowledgeSource",
        entityId: id,
        metadata: body,
      });
      if (error) dbError(error, "Unable to record audit event");
    }

    return NextResponse.json(source);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid update payload." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Unable to update source." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;

    const { error: deleteError } = await getDb().from("KnowledgeSource").delete().eq("id", id);
    if (deleteError) dbError(deleteError, "Unable to delete source");

    const { error } = await getDb().from("AuditEvent").insert({
      type: AuditEventType.SOURCE_DELETED,
      userId: session.user.id,
      entityType: "KnowledgeSource",
      entityId: id,
    });
    if (error) dbError(error, "Unable to record audit event");

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Unable to delete source." },
      { status: 500 },
    );
  }
}
