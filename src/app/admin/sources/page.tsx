import { requireAdmin } from "@/lib/auth";
import { dbError, getDb } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { SourcesManager } from "@/components/admin/sources-manager";

export default async function AdminSourcesPage() {
  await requireAdmin();

  const { data: sources, error } = await getDb().from("KnowledgeSource").select("*").order("updatedAt", { ascending: false });
  if (error) dbError(error, "Unable to load sources");

  return (
    <AppShell
      title="Approved sources"
      subtitle="Manage Confluence pages indexed for staff answers."
    >
      <SourcesManager initialSources={sources ?? []} />
    </AppShell>
  );
}
