import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";

export type AccountRow = {
  id: string;
  label: string;
  identifier: string;
  isActive: boolean;
  lastTestStatus?: string | null;
};

export function AccountList({
  items,
  basePath,
  identifierLabel,
  emptyMessage,
}: {
  items: AccountRow[];
  basePath: string;
  identifierLabel: string;
  emptyMessage: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link href={`${basePath}/novo`} className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Link>
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{emptyMessage}</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`${basePath}/${item.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.label}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {identifierLabel}: {item.identifier}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!item.isActive && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    inativo
                  </span>
                )}
                <StatusBadge status={item.lastTestStatus} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
