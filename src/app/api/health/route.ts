import { NextResponse } from "next/server";
import { getDiagnosticsSummary } from "@/lib/logger";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      diagnostics: getDiagnosticsSummary(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        diagnostics: getDiagnosticsSummary(),
      },
      { status: 503 },
    );
  }
}
