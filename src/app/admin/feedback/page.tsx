import { requireAdmin } from "@/lib/auth";
import { dbError, getDb } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export default async function AdminFeedbackPage() {
  await requireAdmin();

  const { data: feedback, error } = await getDb().from("AnswerFeedback").select("id, helpful, reason, comments, suggestsDocumentationGap, createdAt, User(email, name), Message(content), Conversation(title)").order("createdAt", { ascending: false }).limit(50);
  if (error) dbError(error, "Unable to load feedback");

  return (
    <AppShell
      title="Feedback and gaps"
      subtitle="Review staff feedback to identify documentation improvements."
    >
      {(feedback ?? []).length === 0 ? (
        <Card className="p-8 text-center text-[var(--color-muted)]">
          No feedback submitted yet.
        </Card>
      ) : (
        <div className="grid gap-4">
          {(feedback ?? []).map((item: Record<string, unknown>) => {
            const user = item.User as { email: string; name: string | null };
            const message = item.Message as { content: string };
            const conversation = item.Conversation as { title: string | null };
            return (
              <Card key={item.id as string}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>
                      {conversation.title ?? "Conversation feedback"}
                    </CardTitle>
                    <p className="text-sm text-[var(--color-muted)]">
                      {user.name ?? user.email} ·{" "}
                      {formatDateTime(item.createdAt as string)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge
                      variant={item.helpful === "HELPFUL" ? "success" : "warning"}
                    >
                      {(item.helpful as string).replace("_", " ")}
                    </Badge>
                    {item.suggestsDocumentationGap ? (
                      <Badge variant="warning">Possible gap</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>{message.content.slice(0, 320)}</p>
                  {item.reason ? (
                    <p className="text-[var(--color-muted)]">
                      Reason: {item.reason as string}
                    </p>
                  ) : null}
                  {item.comments ? <p>{item.comments as string}</p> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
