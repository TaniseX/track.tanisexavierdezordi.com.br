import { cn } from "@/lib/utils";

/**
 * Wordmark em texto (sem asset de imagem ainda — trocar por logo real assim
 * que tivermos o arquivo, mesmo padrão de chip escuro fixo usado no projeto
 * anterior pra garantir legibilidade nos dois temas do painel).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-[#09090b] px-2.5 py-1.5",
        className,
      )}
    >
      <span className="text-sm font-bold tracking-tight text-white">Tanise</span>
      <span className="text-sm font-bold tracking-tight text-primary">Xavier</span>
    </div>
  );
}
