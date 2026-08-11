"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  History,
  LayoutDashboard,
  MessageSquare,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/history", label: "History", icon: History },
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/sources", label: "Sources", icon: BookOpen },
  { href: "/admin/sync", label: "Sync", icon: RefreshCw },
  { href: "/admin/feedback", label: "Feedback", icon: Settings2 },
];

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-primary-dark)] p-5 text-white md:flex">
          <div className="mb-8">
            <p className="text-xs tracking-[0.2em] text-[var(--color-mint)] uppercase">
              Church of the Highlands
            </p>
            <h1 className="mt-2 text-xl leading-tight font-bold">
              Documentation Assistant
            </h1>
          </div>
          <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
            {nav.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-white/10 pt-4">
            <p className="text-sm font-medium">Guest access</p>
            <p className="text-xs text-white/70">Authentication disabled</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-[var(--color-border)] bg-[var(--color-header)] px-4 py-4 backdrop-blur md:px-8">
            <div>
              {title ? (
                <h2 className="text-2xl font-bold text-[var(--color-primary)]">
                  {title}
                </h2>
              ) : null}
              {subtitle ? (
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <nav
              className="mt-4 flex gap-2 overflow-x-auto md:hidden"
              aria-label="Mobile"
            >
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
                    pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)
                      ? "bg-[var(--color-primary-dark)] text-white"
                      : "bg-[var(--color-surface-muted)] text-[var(--color-primary)]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
