import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export default async function AdminFeedbackPage() {
  await requireAdmin();

  const feedback = await prisma.answerFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { email: true, name: true } },
      message: { select: { content: true } },
      conversation: { select: { title: true } },
    },
  });

  return (
    <AppShell
      title="Feedback and gaps"
      subtitle="Review staff feedback to identify documentation improvements."
    >
      {feedback.length === 0 ? (
        <Card className="p-8 text-center text-[var(--color-muted)]">
          No feedback submitted yet.
        </Card>
      ) : (
        <div className="grid gap-4">
          {feedback.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>
                    {item.conversation.title ?? "Conversation feedback"}
                  </CardTitle>
                  <p className="text-sm text-[var(--color-muted)]">
                    {item.user.name ?? item.user.email} ·{" "}
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge
                    variant={item.helpful === "HELPFUL" ? "success" : "warning"}
                  >
                    {item.helpful.replace("_", " ")}
                  </Badge>
                  {item.suggestsDocumentationGap ? (
                    <Badge variant="warning">Possible gap</Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{item.message.content.slice(0, 320)}</p>
                {item.reason ? (
                  <p className="text-[var(--color-muted)]">
                    Reason: {item.reason}
                  </p>
                ) : null}
                {item.comments ? <p>{item.comments}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
