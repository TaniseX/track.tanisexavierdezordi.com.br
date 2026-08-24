import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/config/account-form";
import { StatusBadge } from "@/components/config/status-badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateGa4Account, deleteGa4Account, testGa4Account } from "../actions";

export default async function EditarContaGa4Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: account } = await admin.from("ga4_accounts").select("*").eq("id", id).single();
  if (!account) notFound();

  const updateAction = updateGa4Account.bind(null, id);
  const deleteAction = deleteGa4Account.bind(null, id);
  const testAction = testGa4Account.bind(null, id);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{account.label}</h1>
        <p className="font-mono text-sm text-muted-foreground">{account.measurement_id}</p>
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
          identifierLabel="Measurement ID"
          identifierName="measurement_id"
          identifierPlaceholder="G-XXXXXXXXXX"
          secretLabel="API Secret"
          secretName="api_secret"
          defaultLabel={account.label}
          defaultIdentifier={account.measurement_id}
          secretIsSet
          showActiveToggle
          defaultIsActive={account.is_active}
          submitLabel="Salvar alterações"
        />
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="font-semibold text-destructive">Remover conta</h2>
        <p className="text-sm text-muted-foreground">
          Essa conta para de receber eventos imediatamente.
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
