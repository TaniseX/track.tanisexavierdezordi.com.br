"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SyncButton({ adAccountId }: { adAccountId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ads-insights/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_account_id: adAccountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao sincronizar.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" onClick={handleSync} disabled={pending}>
        <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
        {pending ? "Sincronizando..." : "Sincronizar agora"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
