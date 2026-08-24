import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/config/account-form";
import { StatusBadge } from "@/components/config/status-badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateMetaAdAccount, deleteMetaAdAccount, testMetaAdAccount } from "../actions";

export default async function EditarContaAnuncioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("meta_ad_accounts")
    .select("*")
    .eq("id", id)
    .single();
  if (!account) notFound();

  const updateAction = updateMetaAdAccount.bind(null, id);
  const deleteAction = deleteMetaAdAccount.bind(null, id);
  const testAction = testMetaAdAccount.bind(null, id);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{account.label}</h1>
        <p className="font-mono text-sm text-muted-foreground">{account.ad_account_id}</p>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Testar conexão</h2>
          <StatusBadge status={account.last_test_status} />
        </div>
        {account.last_test_message && (
          <p className="text-sm text-muted-foreground">{account.last_test_message}</p>
        )}
        <form action={testAction}>
          <Button type="submit" variant="outline" size="sm">
            Testar conexão
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <AccountForm
          action={updateAction}
          identifierLabel="Ad Account ID"
          identifierName="ad_account_id"
          identifierPlaceholder="act_1234567890"
          secretLabel="Access Token"
          secretName="access_token"
          defaultLabel={account.label}
          defaultIdentifier={account.ad_account_id}
          secretIsSet
          showActiveToggle
          defaultIsActive={account.is_active}
          submitLabel="Salvar alterações"
        />
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="font-semibold text-destructive">Remover conta</h2>
        <p className="text-sm text-muted-foreground">
          Essa conta para de ser usada na tela de Campanhas.
        </p>
        <form action={deleteAction}>
          <Button type="submit" variant="destructive" size="sm">
            Remover
          </Button>
        </form>
      </Card>
    </div>
  );
}
