import { AccountList } from "@/components/config/account-list";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Ga4ListPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ga4_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contas GA4</h1>
        <p className="text-sm text-muted-foreground">
          Propriedades GA4 que recebem eventos via Measurement Protocol.
        </p>
      </div>
      <AccountList
        items={(data ?? []).map((a) => ({
          id: a.id,
          label: a.label,
          identifier: a.measurement_id,
          isActive: a.is_active,
          lastTestStatus: a.last_test_status,
        }))}
        basePath="/configuracoes/ga4"
        identifierLabel="Measurement ID"
        emptyMessage="Nenhuma conta GA4 cadastrada ainda."
      />
    </div>
  );
}
