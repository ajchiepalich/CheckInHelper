import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { SyncPanel } from "@/components/admin/sync-panel";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminSyncPage() {
  await requireAdmin();

  const runs = await prisma.syncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      triggeredBy: { select: { email: true, name: true } },
      items: {
        include: {
          knowledgeSource: { select: { title: true, confluencePageId: true } },
        },
      },
    },
  });

  return (
    <AppShell
      title="Synchronization"
      subtitle="Monitor documentation indexing runs and errors."
    >
      <SyncPanel />

      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-semibold text-[var(--color-primary)]">
          Recent runs
        </h3>
        {runs.length === 0 ? (
          <Card className="p-8 text-center text-[var(--color-muted)]">
            No sync runs yet.
          </Card>
        ) : (
          runs.map((run) => (
            <Card key={run.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{run.triggerType.replace("_", " ")}</CardTitle>
                  <p className="text-sm text-[var(--color-muted)]">
                    Started {formatDateTime(run.startedAt)}
                    {run.finishedAt
                      ? ` · Finished ${formatDateTime(run.finishedAt)}`
                      : ""}
                  </p>
                </div>
                <Badge
                  variant={
                    run.status === "COMPLETED"
                      ? "success"
                      : run.status === "FAILED"
                        ? "error"
                        : "muted"
                  }
                >
                  {run.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  Added {run.addedCount}, updated {run.updatedCount}, unchanged{" "}
                  {run.unchangedCount}, failed {run.failedCount}
                  {run.triggeredBy
                    ? ` · Triggered by ${run.triggeredBy.name ?? run.triggeredBy.email}`
                    : ""}
                </p>
                {run.errorSummary ? (
                  <p className="text-[var(--color-error)]">
                    {run.errorSummary}
                  </p>
                ) : null}
                {run.items.length > 0 ? (
                  <ul className="space-y-2 rounded-xl bg-[#f7f6f2] p-4">
                    {run.items.map((item) => (
                      <li key={item.id}>
                        <span className="font-medium">
                          {item.knowledgeSource.title}
                        </span>{" "}
                        — {item.status}
                        {item.message ? `: ${item.message}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
