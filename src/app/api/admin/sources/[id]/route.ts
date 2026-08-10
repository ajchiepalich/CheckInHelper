import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuditEventType } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    const source = await prisma.knowledgeSource.update({
      where: { id },
      data: body,
    });

    if (body.enabled !== undefined) {
      await prisma.auditEvent.create({
        data: {
          type: body.enabled
            ? AuditEventType.SOURCE_ENABLED
            : AuditEventType.SOURCE_DISABLED,
          userId: session.user.id,
          entityType: "KnowledgeSource",
          entityId: id,
        },
      });
    } else {
      await prisma.auditEvent.create({
        data: {
          type: AuditEventType.SOURCE_UPDATED,
          userId: session.user.id,
          entityType: "KnowledgeSource",
          entityId: id,
          metadata: body,
        },
      });
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

    await prisma.knowledgeSource.delete({ where: { id } });

    await prisma.auditEvent.create({
      data: {
        type: AuditEventType.SOURCE_DELETED,
        userId: session.user.id,
        entityType: "KnowledgeSource",
        entityId: id,
      },
    });

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
