import { NextResponse } from "next/server";
import { getDiagnosticsSummary } from "@/lib/logger";
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
