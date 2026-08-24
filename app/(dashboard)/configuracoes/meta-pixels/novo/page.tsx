import { Card } from "@/components/ui/card";
import { AccountForm } from "@/components/config/account-form";
import { createMetaPixel } from "../actions";

export default function NovoPixelMetaPage() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Novo pixel Meta</h1>
        <p className="text-sm text-muted-foreground">
          O token da Conversions API é gerado em Events Manager → Configurações → Conversions API.
        </p>
      </div>
      <Card className="p-6">
        <AccountForm
          action={createMetaPixel}
          identifierLabel="Pixel ID"
          identifierName="pixel_id"
          identifierPlaceholder="123456789012345"
          secretLabel="Token da Conversions API"
          secretName="capi_token"
          submitLabel="Adicionar"
        />
      </Card>
    </div>
  );
}
