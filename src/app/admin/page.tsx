import { FeedbackHelpful, SourceStatus, dbError, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const db = getDb();
  const [enabled, failed, unavailable, indexed, negative, successful, latest, citations, unhelpful] = await Promise.all([
    db.from("KnowledgeSource").select("id", { count: "exact", head: true }).eq("enabled", true),
    db.from("KnowledgeSource").select("id", { count: "exact", head: true }).eq("status", SourceStatus.FAILED),
    db.from("KnowledgeSource").select("id", { count: "exact", head: true }).eq("status", SourceStatus.UNAVAILABLE),
    db.from("KnowledgeFile").select("id", { count: "exact", head: true }).eq("isActive", true),
    db.from("AnswerFeedback").select("id", { count: "exact", head: true }).in("helpful", [FeedbackHelpful.NOT_HELPFUL, FeedbackHelpful.INCORRECT]).gte("createdAt", thirtyDaysAgo.toISOString()),
    db.from("SyncRun").select("*").eq("status", "COMPLETED").order("finishedAt", { ascending: false }).limit(1).maybeSingle(),
    db.from("SyncRun").select("*").order("startedAt", { ascending: false }).limit(1).maybeSingle(),
    db.from("MessageCitation").select("knowledgeSourceId"),
    db.from("AnswerFeedback").select("id, helpful, Message(content)").in("helpful", [FeedbackHelpful.NOT_HELPFUL, FeedbackHelpful.INCORRECT]).order("createdAt", { ascending: false }).limit(5),
  ]);
  for (const result of [enabled, failed, unavailable, indexed, negative, successful, latest, citations, unhelpful]) if (result.error) dbError(result.error, "Unable to load dashboard data");
  const counts = new Map<string, number>();
  for (const citation of citations.data ?? []) if (citation.knowledgeSourceId) counts.set(citation.knowledgeSourceId, (counts.get(citation.knowledgeSourceId) ?? 0) + 1);
  const topCitations = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const citedSourceIds = topCitations.map(([id]) => id);
  const { data: citedSources, error: sourcesError } = citedSourceIds.length ? await db.from("KnowledgeSource").select("id, title").in("id", citedSourceIds) : { data: [], error: null };
  if (sourcesError) dbError(sourcesError, "Unable to load cited sources");
  const citedMap = new Map<string, string>((citedSources ?? []).map((s: { id: string; title: string }) => [s.id, s.title]));
  const enabledSources = enabled.count ?? 0; const failedSources = failed.count ?? 0; const unavailableSources = unavailable.count ?? 0; const indexedFiles = indexed.count ?? 0; const negativeFeedback = negative.count ?? 0; const lastSuccessfulSync = successful.data; const latestSync = latest.data; const recentUnhelpful = unhelpful.data ?? [];

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
                {topCitations.map(([sourceId, count]) => (
                  <li
                    key={sourceId}
                    className="flex justify-between gap-4"
                  >
                    <span>
                      {citedMap.get(sourceId) ??
                        "Unknown source"}
                    </span>
                    <span className="font-semibold text-[var(--color-primary)]">
                      {count}
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
                {recentUnhelpful.map((item: { id: string; helpful: string; Message: { content: string } }) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-[var(--color-border)] p-4"
                  >
                    <p className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                      {item.helpful.replace("_", " ")}
                    </p>
                    <p className="mt-2 text-sm">
                      {item.Message.content.slice(0, 240)}
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
