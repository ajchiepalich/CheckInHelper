"use client";

import { useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { CitationView } from "@/components/chat/citation-card";

export function SourceDetailsBody({
  citation,
}: {
  citation: CitationView | null;
}) {
  if (!citation) {
    return (
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        Select a citation to preview the source details here.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3 text-sm">
      <p className="font-semibold">{citation.title}</p>
      <p className="text-[var(--color-muted)]">
        {citation.spaceKey ? `Space ${citation.spaceKey}` : "Confluence source"}
      </p>
      <a
        href={citation.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex font-medium text-[var(--color-secondary)] underline"
      >
        Open in Confluence
      </a>
    </div>
  );
}

export function SourceDetailsSheet({
  citation,
  open,
  onOpenChange,
}: {
  citation: CitationView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mq.matches) onOpenChange(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="source-sheet-overlay fixed inset-0 z-50 bg-black/40 lg:hidden" />
        <Dialog.Content className="source-sheet fixed inset-x-0 bottom-0 z-50 rounded-t-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-soft)] outline-none lg:hidden">
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold text-[var(--color-primary)]">
              Source details
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Preview the selected documentation source.
            </Dialog.Description>
            <Dialog.Close className="pressable rounded-lg p-1 text-[var(--color-muted)]">
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>
          <SourceDetailsBody citation={citation} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
