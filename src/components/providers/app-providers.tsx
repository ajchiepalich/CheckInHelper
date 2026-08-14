"use client";

import { MockModeBanner } from "@/components/layout/mock-mode-banner";

export function AppProviders({
  children,
  mockMode,
}: {
  children: React.ReactNode;
  mockMode: boolean;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {mockMode ? <MockModeBanner /> : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
