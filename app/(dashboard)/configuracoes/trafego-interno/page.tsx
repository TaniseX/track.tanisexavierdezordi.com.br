import { Trash2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InternalIpForm } from "@/components/config/internal-ip-form";
import { removeInternalIp } from "./actions";

export default async function TrafegoInternoPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("internal_ips").select("*").order("created_at", { ascending: false });
  const ips = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tráfego interno</h1>
        <p className="text-sm text-muted-foreground">
          IPs cadastrados aqui (equipe testando o próprio funil) somem do painel e não são mais
          enviados pro Meta/GA4 — nada é gravado no banco pra esses IPs.
        </p>
      </div>

      <Card className="p-4">
        <InternalIpForm />
      </Card>

      {ips.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum IP cadastrado ainda.</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {ips.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">{item.ip}</p>
                {item.label && <p className="truncate text-xs text-muted-foreground">{item.label}</p>}
              </div>
              <form action={removeInternalIp.bind(null, item.id)}>
                <Button variant="outline" size="icon" type="submit" aria-label="Remover">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
