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
    <>
      {mockMode ? <MockModeBanner /> : null}
      {children}
    </>
  );
}
