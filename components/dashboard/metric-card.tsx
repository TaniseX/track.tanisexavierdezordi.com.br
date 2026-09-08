import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card className="p-4">
      {/* Ícone ao lado do RÓTULO (linha curta, sobra espaço), não do valor —
          tentativa anterior deixava o ícone competir com o número pela
          largura do card (o mais apertado dos breakpoints é grid-cols-6 no
          desktop) e isso forçava o número a quebrar no meio (ex: "R$ 75,8"
          / "4"), pior que truncar. Assim o valor fica sozinho numa linha
          com a largura inteira do card — cabe em uma linha no caso normal;
          truncate é só a rede de segurança pra um valor absurdamente
          grande, não deve disparar na prática. */}
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
      <p className="mt-1 truncate font-mono text-lg font-bold tabular-nums">{value}</p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
