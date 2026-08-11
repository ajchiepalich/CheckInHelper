#!/usr/bin/env tsx
import { validateAndCreateSource } from "../src/lib/sync/service";

async function main() {
  const pageIdOrUrl = process.argv[2];
  if (!pageIdOrUrl) {
    console.error("Usage: npm run add-source -- <confluence-url-or-page-id>");
    process.exit(1);
  }

  const source = await validateAndCreateSource({ pageIdOrUrl });
  console.log(JSON.stringify(source, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
