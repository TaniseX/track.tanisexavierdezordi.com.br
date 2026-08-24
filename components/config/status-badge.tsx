import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
        nunca testado
      </span>
    );
  }

  const isOk = status === "ok";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        isOk
          ? "bg-primary/10 text-primary"
          : "bg-destructive/10 text-destructive",
      )}
    >
      {isOk ? "conectado" : "erro"}
    </span>
  );
}
