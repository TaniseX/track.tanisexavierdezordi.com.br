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
    <Card className="flex items-start justify-between gap-2 p-4">
      {/* min-w-0: sem isso um item flex não encolhe abaixo do conteúdo
          intrínseco — em grid-cols-2 no celular (ou grid-cols-6 no desktop,
          que é o mais apertado dos três breakpoints aqui) um valor grande
          empurraria a largura do card e quebrava a grid. truncate no
          label/hint corta com "..." (aceitável, é texto decorativo) — mas
          NUNCA no valor: cortar o número em si (ex: "R$ 4..." em vez de
          "R$ 47,90") esconde o dado que o card existe pra mostrar. Se não
          couber numa linha, deixa quebrar (`break-words`) em vez de
          truncar; `text-xl` (não `text-2xl`) dá mais folga pra isso ser
          raro mesmo em grid-cols-6. */}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="break-words font-mono text-xl font-bold tabular-nums">{value}</p>
        {hint && <p className="truncate mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      )}
    </Card>
  );
}
