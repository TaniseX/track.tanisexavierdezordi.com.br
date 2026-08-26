import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo real da cliente (public/brand/logo.png) — recortado e com o fundo
 * branco removido (chave de cor -> alpha) a partir do PNG enviado. Como o
 * traço é verde/azul sobre fundo transparente, funciona direto nos dois
 * temas do painel, sem precisar de chip de fundo fixo (diferente da versão
 * anterior, que era um wordmark em texto branco só legível no escuro).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Tanise Xavier"
      width={512}
      height={512}
      priority
      className={cn("h-9 w-9", className)}
    />
  );
}
