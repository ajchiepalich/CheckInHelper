import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, truncate } from "@/lib/utils";

export default async function HistoryPage() {
  const session = await requireAuth();

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      _count: { select: { messages: true } },
    },
  });

  return (
    <AppShell
      title="Conversation history"
      subtitle="Your recent documentation questions and answers."
    >
      {conversations.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-[var(--color-muted)]">
            You have not started any conversations yet.
          </p>
          <Link
            href="/chat"
            className="mt-4 inline-block font-semibold text-[var(--color-secondary)]"
          >
            Start chatting
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4">
          {conversations.map((conversation) => (
            <Card key={conversation.id}>
              <CardHeader>
                <CardTitle>
                  {conversation.title ?? "Untitled conversation"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--color-muted)]">
                  {conversation._count.messages} messages · Updated{" "}
                  {formatDateTime(conversation.updatedAt)}
                </p>
                {conversation.messages[0] ? (
                  <p className="mt-2 text-sm">
                    {truncate(conversation.messages[0].content, 140)}
                  </p>
                ) : null}
                <Link
                  href={`/chat?conversation=${conversation.id}`}
                  className="mt-4 inline-block text-sm font-semibold text-[var(--color-secondary)]"
                >
                  Open conversation
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
