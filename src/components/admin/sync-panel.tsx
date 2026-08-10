"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SyncPanel() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function triggerSync(options?: {
    dryRun?: boolean;
    retryFailedOnly?: boolean;
  }) {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options ?? {}),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Sync failed.");
    } else {
      setMessage(
        `Sync ${data.status}. Added ${data.summary.added}, updated ${data.summary.updated}, unchanged ${data.summary.unchanged}, failed ${data.summary.failed}.`,
      );
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual synchronization</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button onClick={() => triggerSync()} disabled={loading}>
          Run full sync
        </Button>
        <Button
          variant="outline"
          onClick={() => triggerSync({ dryRun: true })}
          disabled={loading}
        >
          Dry run
        </Button>
        <Button
          variant="outline"
          onClick={() => triggerSync({ retryFailedOnly: true })}
          disabled={loading}
        >
          Retry failed
        </Button>
        {message ? (
          <p className="w-full text-sm text-[var(--color-muted)]">{message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
