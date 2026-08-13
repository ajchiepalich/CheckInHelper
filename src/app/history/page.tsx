import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { dbError, getDb } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, truncate } from "@/lib/utils";

export default async function HistoryPage() {
  const session = await requireAuth();

  const { data: conversations, error } = await getDb().from("Conversation").select("id, title, updatedAt, Message(id, content, createdAt)").eq("userId", session.user.id).order("updatedAt", { ascending: false }).limit(30);
  if (error) dbError(error, "Unable to load conversation history");

  return (
    <AppShell
      title="Conversation history"
      subtitle="Your recent documentation questions and answers."
    >
      {(conversations ?? []).length === 0 ? (
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
          {(conversations ?? []).map((conversation: { id: string; title: string | null; updatedAt: string; Message: { id: string; content: string; createdAt: string }[] | null }) => {
            const messages = (conversation.Message ?? []) as { id: string; content: string; createdAt: string }[];
            const firstMessage = messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
            return (
              <Card key={conversation.id}>
                <CardHeader>
                  <CardTitle>
                    {conversation.title ?? "Untitled conversation"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--color-muted)]">
                    {messages.length} messages · Updated{" "}
                    {formatDateTime(conversation.updatedAt)}
                  </p>
                  {firstMessage ? (
                    <p className="mt-2 text-sm">
                      {truncate(firstMessage.content, 140)}
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
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
