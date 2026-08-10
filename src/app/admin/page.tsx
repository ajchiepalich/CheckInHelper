import { FeedbackHelpful, SourceStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    enabledSources,
    failedSources,
    unavailableSources,
    indexedFiles,
    negativeFeedback,
    lastSuccessfulSync,
    latestSync,
    topCitations,
    recentUnhelpful,
  ] = await Promise.all([
    prisma.knowledgeSource.count({ where: { enabled: true } }),
    prisma.knowledgeSource.count({ where: { status: SourceStatus.FAILED } }),
    prisma.knowledgeSource.count({
      where: { status: SourceStatus.UNAVAILABLE },
    }),
    prisma.knowledgeFile.count({ where: { isActive: true } }),
    prisma.answerFeedback.count({
      where: {
        helpful: {
          in: [FeedbackHelpful.NOT_HELPFUL, FeedbackHelpful.INCORRECT],
        },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.syncRun.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.messageCitation.groupBy({
      by: ["knowledgeSourceId"],
      _count: { _all: true },
      orderBy: { _count: { knowledgeSourceId: "desc" } },
      take: 5,
    }),
    prisma.answerFeedback.findMany({
      where: {
        helpful: {
          in: [FeedbackHelpful.NOT_HELPFUL, FeedbackHelpful.INCORRECT],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        message: { select: { content: true } },
      },
    }),
  ]);

  const citedSourceIds = topCitations
    .map((c) => c.knowledgeSourceId)
    .filter((id): id is string => Boolean(id));

  const citedSources = citedSourceIds.length
    ? await prisma.knowledgeSource.findMany({
        where: { id: { in: citedSourceIds } },
        select: { id: true, title: true },
      })
    : [];

  const citedMap = new Map(citedSources.map((s) => [s.id, s.title]));

  const stats = [
    { label: "Enabled sources", value: enabledSources },
    { label: "Indexed files", value: indexedFiles },
    { label: "Failed sources", value: failedSources },
    { label: "Unavailable sources", value: unavailableSources },
    { label: "Negative feedback (30d)", value: negativeFeedback },
    {
      label: "Changed in latest run",
      value: latestSync ? latestSync.addedCount + latestSync.updatedCount : 0,
    },
  ];

  return (
    <AppShell
      title="Admin overview"
      subtitle="Documentation coverage, sync health, and staff feedback."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardTitle className="text-base text-[var(--color-muted)]">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[var(--color-primary)]">
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Last successful sync</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--color-muted)]">
            {lastSuccessfulSync ? (
              <>
                <p>{formatDateTime(lastSuccessfulSync.finishedAt)}</p>
                <p className="mt-2">
                  Added {lastSuccessfulSync.addedCount}, updated{" "}
                  {lastSuccessfulSync.updatedCount}, unchanged{" "}
                  {lastSuccessfulSync.unchangedCount}, failed{" "}
                  {lastSuccessfulSync.failedCount}
                </p>
              </>
            ) : (
              <p>No successful sync runs yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most cited pages</CardTitle>
          </CardHeader>
          <CardContent>
            {topCitations.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No citation data yet.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {topCitations.map((item) => (
                  <li
                    key={item.knowledgeSourceId ?? "unknown"}
                    className="flex justify-between gap-4"
                  >
                    <span>
                      {citedMap.get(item.knowledgeSourceId ?? "") ??
                        "Unknown source"}
                    </span>
                    <span className="font-semibold text-[var(--color-primary)]">
                      {item._count._all}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Likely documentation gaps</CardTitle>
          </CardHeader>
          <CardContent>
            {recentUnhelpful.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                No negative feedback has been submitted yet.
              </p>
            ) : (
              <ul className="space-y-4">
                {recentUnhelpful.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-[var(--color-border)] p-4"
                  >
                    <p className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                      {item.helpful.replace("_", " ")}
                    </p>
                    <p className="mt-2 text-sm">
                      {item.message.content.slice(0, 240)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
