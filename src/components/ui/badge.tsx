import { cn } from "@/lib/utils";

const variants = {
  default: "bg-[var(--color-accent-soft)] text-[var(--color-secondary)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-secondary)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
  error: "bg-[var(--color-error-bg)] text-[var(--color-error)]",
  muted: "bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
} as const;

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
