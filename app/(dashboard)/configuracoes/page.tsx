import { headers } from "next/headers";
import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/config/copy-button";
import { ConfigLinkCard } from "@/components/config/config-link-card";
import { SettingsForm } from "@/components/config/settings-form";
import { WebhookTokenForm } from "@/components/config/webhook-token-form";
import { getSettings } from "@/lib/config/settings";
import { readSecret } from "@/lib/vault/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { regenerateWebhookToken } from "./actions";

export default async function ConfiguracoesPage() {
  const settings = await getSettings();
  const webhookToken = settings.webhook_token_id
    ? await readSecret(settings.webhook_token_id)
    : null;

  const headersList = await headers();
  const host = headersList.get("host") ?? "track.tanisexavierdezordi.com.br";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const webhookUrl = webhookToken ? `${protocol}://${host}/api/webhook/guru/${webhookToken}` : null;

  const admin = createAdminClient();
  const [ga4, pixels, adAccounts, internalIps] = await Promise.all([
    admin.from("ga4_accounts").select("*", { count: "exact", head: true }),
    admin.from("meta_pixels").select("*", { count: "exact", head: true }),
    admin.from("meta_ad_accounts").select("*", { count: "exact", head: true }),
    admin.from("internal_ips").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Webhook, moeda e as contas de GA4/Meta que recebem os eventos.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Webhook da Guru</h2>
        {webhookUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
              {webhookUrl}
            </code>
            <CopyButton value={webhookUrl} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum token gerado ainda.</p>
        )}
        <form action={regenerateWebhookToken}>
          <Button type="submit" variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            {webhookUrl ? "Gerar novo token" : "Gerar token"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Cole essa URL no cadastro de webhook da Digital Manager Guru. Trocar o token (gerado
          automaticamente ou definido manualmente abaixo) invalida o anterior — vai precisar
          atualizar lá também.
        </p>

        <div className="border-t border-border pt-4">
          <WebhookTokenForm />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Geral</h2>
        <SettingsForm settings={settings} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ConfigLinkCard href="/configuracoes/ga4" title="GA4" count={ga4.count ?? 0} />
        <ConfigLinkCard
          href="/configuracoes/meta-pixels"
          title="Pixels Meta"
          count={pixels.count ?? 0}
        />
        <ConfigLinkCard
          href="/configuracoes/meta-ad-accounts"
          title="Contas de anúncio"
          count={adAccounts.count ?? 0}
        />
        <ConfigLinkCard
          href="/configuracoes/trafego-interno"
          title="Tráfego interno"
          count={internalIps.count ?? 0}
          countLabel={["IP", "IPs"]}
        />
      </div>
    </div>
  );
}
