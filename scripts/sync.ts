#!/usr/bin/env tsx
import { SyncTriggerType } from "@prisma/client";
import { runSynchronization } from "../src/lib/sync/service";

async function main() {
  const sourceId = process.argv
    .find((arg) => arg.startsWith("--source="))
    ?.split("=")[1];
  const dryRun = process.argv.includes("--dry-run");
  const retryFailedOnly = process.argv.includes("--retry-failed");

  const result = await runSynchronization({
    triggerType: sourceId
      ? SyncTriggerType.SINGLE_SOURCE
      : SyncTriggerType.MANUAL,
    sourceId,
    dryRun,
    retryFailedOnly,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
