import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateAndCreateSource } from "@/lib/sync/service";

export async function GET() {
  try {
    await requireAdmin();
    const sources = await prisma.knowledgeSource.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(sources);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Unable to load sources." },
      { status: 500 },
    );
  }
}

const createSchema = z.object({
  pageIdOrUrl: z.string().min(1),
  category: z.string().optional(),
  audience: z.string().optional(),
  classification: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = createSchema.parse(await request.json());
    const source = await validateAndCreateSource({
      ...body,
      userId: session.user.id,
    });
    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid source payload." },
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
      {
        error: error instanceof Error ? error.message : "Unable to add source.",
      },
      { status: 400 },
    );
  }
}
