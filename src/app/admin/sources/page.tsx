import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { SourcesManager } from "@/components/admin/sources-manager";

export default async function AdminSourcesPage() {
  await requireAdmin();

  const sources = await prisma.knowledgeSource.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell
      title="Approved sources"
      subtitle="Manage Confluence pages indexed for staff answers."
    >
      <SourcesManager initialSources={sources} />
    </AppShell>
  );
}
