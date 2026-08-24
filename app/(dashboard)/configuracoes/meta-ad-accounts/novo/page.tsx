import { Card } from "@/components/ui/card";
import { AccountForm } from "@/components/config/account-form";
import { createMetaAdAccount } from "../actions";

export default function NovaContaAnuncioPage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nova conta de anúncio</h1>
        <p className="text-sm text-muted-foreground">
          Use um access token de sistema (System User) com escopo <code>ads_read</code>.
        </p>
      </div>
      <Card className="p-6">
        <AccountForm
          action={createMetaAdAccount}
          identifierLabel="Ad Account ID"
          identifierName="ad_account_id"
          identifierPlaceholder="act_1234567890"
          secretLabel="Access Token"
          secretName="access_token"
          submitLabel="Adicionar"
        />
      </Card>
    </div>
  );
}
