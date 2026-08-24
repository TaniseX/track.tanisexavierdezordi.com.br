import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { SyncButton } from "@/components/dashboard/sync-button";
import { CampaignTree } from "@/components/dashboard/campaign-tree";
import { buildCampaignTree } from "@/lib/dashboard/campaign-tree";
import { formatDateTime } from "@/lib/format";

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("meta_ad_accounts")
    .select("id, label, ad_account_id, last_synced_at, last_test_status, last_test_message")
    .eq("is_active", true)
    .order("label");

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Árvore campanha → conjunto → anúncio cruzando o Meta Ads com a receita por UTM.
          </p>
        </div>
        <Card className="space-y-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma conta de anúncio ativa cadastrada ainda.</p>
          <Link
            href="/configuracoes/meta-ad-accounts/novo"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Adicionar conta de anúncio
          </Link>
        </Card>
      </div>
    );
  }

  const showAllAccounts = accounts.length > 1 && !params.account;
  const selectedAccount = !showAllAccounts
    ? (accounts.find((a) => a.id === params.account) ?? accounts[0])
    : null;

  const accountIds = selectedAccount ? [selectedAccount.id] : accounts.map((a) => a.id);

  const [{ data: cache }, { data: revByCampaign }, { data: revByAd }, { data: viewsByCampaign }, { data: viewsByAd }] =
    await Promise.all([
      supabase.from("ads_insights_cache").select("*").in("meta_ad_account_id", accountIds),
      supabase.rpc("revenue_by_campaign"),
      supabase.rpc("revenue_by_ad"),
      supabase.rpc("views_by_campaign"),
      supabase.rpc("views_by_ad"),
    ]);

  const tree = buildCampaignTree(
    cache ?? [],
    revByCampaign ?? [],
    revByAd ?? [],
    viewsByCampaign ?? [],
    viewsByAd ?? [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Árvore campanha → conjunto → anúncio cruzando o Meta Ads com a receita por UTM.
          </p>
        </div>
        {selectedAccount && <SyncButton adAccountId={selectedAccount.id} />}
      </div>

      {accounts.length > 1 && (
        <form className="flex flex-wrap gap-3" action="/campanhas" method="get">
          <select
            name="account"
            defaultValue={params.account ?? ""}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Todas as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">
            Aplicar
          </Button>
        </form>
      )}

      {selectedAccount ? (
        <p className="text-xs text-muted-foreground">
          {selectedAccount.last_synced_at
            ? `Última sincronização: ${formatDateTime(selectedAccount.last_synced_at)}`
            : "Ainda não sincronizado."}
          {selectedAccount.last_test_status === "error" &&
            selectedAccount.last_test_message &&
            ` — erro: ${selectedAccount.last_test_message}`}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Mostrando todas as contas — selecione uma específica pra sincronizar.
        </p>
      )}

      {tree.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum dado ainda — selecione uma conta e clique em &quot;Sincronizar agora&quot;.
        </Card>
      ) : (
        <CampaignTree campaigns={tree} />
      )}
    </div>
  );
}
