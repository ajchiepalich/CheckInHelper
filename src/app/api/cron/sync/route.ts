import { NextRequest, NextResponse } from "next/server";
import { SyncTriggerType } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { runSynchronization } from "@/lib/sync/service";
import { verifyCronSecret } from "@/lib/security";

export async function GET(request: NextRequest) {
  const env = getEnv();
  const authHeader = request.headers.get("authorization");

  if (!verifyCronSecret(authHeader, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSynchronization({
    triggerType: SyncTriggerType.CRON,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  return GET(request);
}
