import { ExternalLink } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type CitationView = {
  id?: string;
  title: string;
  sourceUrl: string;
  spaceKey?: string | null;
  confluenceUpdatedAt?: string | Date | null;
  snippet?: string | null;
};

export function CitationCard({
  citation,
  onSelect,
}: {
  citation: CitationView;
  onSelect?: (citation: CitationView) => void;
}) {
  return (
    <Card className="p-4 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="pressable min-w-0 flex-1 text-left"
          onClick={() => onSelect?.(citation)}
        >
          <p className="font-semibold text-[var(--color-primary)]">
            {citation.title}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {citation.spaceKey ? `${citation.spaceKey} · ` : ""}
            Updated {formatRelativeDate(citation.confluenceUpdatedAt)}
          </p>
          {citation.snippet ? (
            <p className="mt-2 line-clamp-3 text-sm text-[var(--color-foreground)]">
              {citation.snippet}
            </p>
          ) : null}
        </button>
        <a
          href={citation.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pressable inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-secondary)]"
          aria-label={`Open ${citation.title} in Confluence`}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </Card>
  );
}
