import { cn } from "@/lib/utils";

const variants = {
  default: "bg-[#eef5f3] text-[var(--color-secondary)]",
  success: "bg-[#e7f5ef] text-[var(--color-secondary)]",
  warning: "bg-[#fff8e8] text-[#6e5530]",
  error: "bg-[#fdecea] text-[var(--color-error)]",
  muted: "bg-[#f1f0ec] text-[var(--color-muted)]",
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
