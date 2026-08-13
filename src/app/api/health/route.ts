import { NextResponse } from "next/server";
import { getDiagnosticsSummary, logError } from "@/lib/logger";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const { error } = await getDb().from("SyncLock").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      diagnostics: getDiagnosticsSummary(),
    });
  } catch (error) {
    logError("health.database.failed", error);
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        diagnostics: getDiagnosticsSummary(),
        database:
          error instanceof Error ? error.message : "Database health check failed.",
      },
      { status: 503 },
    );
  }
}
