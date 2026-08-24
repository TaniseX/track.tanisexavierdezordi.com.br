import { Card } from "@/components/ui/card";
import { AccountForm } from "@/components/config/account-form";
import { createGa4Account } from "../actions";

export default function NovaContaGa4Page() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nova conta GA4</h1>
        <p className="text-sm text-muted-foreground">
          O API secret é gerado em Admin → Data Streams → Measurement Protocol.
        </p>
      </div>
      <Card className="p-6">
        <AccountForm
          action={createGa4Account}
          identifierLabel="Measurement ID"
          identifierName="measurement_id"
          identifierPlaceholder="G-XXXXXXXXXX"
          secretLabel="API Secret"
          secretName="api_secret"
          submitLabel="Adicionar"
        />
      </Card>
    </div>
  );
}
