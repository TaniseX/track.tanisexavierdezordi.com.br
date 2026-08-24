import { AccountList } from "@/components/config/account-list";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function MetaAdAccountsListPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("meta_ad_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contas de anúncio</h1>
        <p className="text-sm text-muted-foreground">
          Usadas pra ler insights do Meta Ads na tela de Campanhas (Fase 6).
        </p>
      </div>
      <AccountList
        items={(data ?? []).map((a) => ({
          id: a.id,
          label: a.label,
          identifier: a.ad_account_id,
          isActive: a.is_active,
          lastTestStatus: a.last_test_status,
        }))}
        basePath="/configuracoes/meta-ad-accounts"
        identifierLabel="Ad Account ID"
        emptyMessage="Nenhuma conta de anúncio cadastrada ainda."
      />
    </div>
  );
}
