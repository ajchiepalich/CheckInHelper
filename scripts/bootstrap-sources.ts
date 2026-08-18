#!/usr/bin/env tsx
import { KNOWLEDGE_SOURCES } from "../config/knowledge-sources";
import { validateAndCreateSource } from "../src/lib/sync/service";

async function main() {
  for (const source of KNOWLEDGE_SOURCES) {
    try {
      const created = await validateAndCreateSource(source);
      console.log(`Added: ${created.title} (${created.id})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already registered")) {
        console.log(`Skipped (exists): ${source.pageIdOrUrl}`);
        continue;
      }
      throw error;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
