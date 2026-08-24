import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  sent: "bg-primary/10 text-primary",
  partial: "bg-amber/10 text-amber",
  error: "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground",
  pending: "border border-border text-muted-foreground",
};

export function EventStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[status] ?? STYLES.pending,
      )}
    >
      {status}
    </span>
  );
}
