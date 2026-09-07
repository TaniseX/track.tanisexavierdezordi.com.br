"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Re-roda os Server Components da página atual (router.refresh() do App
 * Router — mesmo mecanismo já usado em SyncButton) sem recarregar a página
 * inteira: mantém filtro de data, tema, posição de scroll etc. Fica na
 * Topbar, visível em toda página autenticada — usuário pedido explícito
 * pra não precisar de F5/refresh do navegador.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-label="Atualizar dados"
      title="Atualizar dados"
    >
      <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
    </Button>
  );
}
