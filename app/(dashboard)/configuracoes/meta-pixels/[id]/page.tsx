import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/config/account-form";
import { StatusBadge } from "@/components/config/status-badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateMetaPixel, deleteMetaPixel, testMetaPixel } from "../actions";

export default async function EditarPixelMetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: pixel } = await admin.from("meta_pixels").select("*").eq("id", id).single();
  if (!pixel) notFound();

  const updateAction = updateMetaPixel.bind(null, id);
  const deleteAction = deleteMetaPixel.bind(null, id);
  const testAction = testMetaPixel.bind(null, id);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{pixel.label}</h1>
        <p className="font-mono text-sm text-muted-foreground">{pixel.pixel_id}</p>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Testar conexão</h2>
          <StatusBadge status={pixel.last_test_status} />
        </div>
        {pixel.last_test_message && (
          <p className="text-sm text-muted-foreground">{pixel.last_test_message}</p>
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
          identifierLabel="Pixel ID"
          identifierName="pixel_id"
          identifierPlaceholder="123456789012345"
          secretLabel="Token da Conversions API"
          secretName="capi_token"
          defaultLabel={pixel.label}
          defaultIdentifier={pixel.pixel_id}
          secretIsSet
          showActiveToggle
          defaultIsActive={pixel.is_active}
          submitLabel="Salvar alterações"
        />
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="font-semibold text-destructive">Remover pixel</h2>
        <p className="text-sm text-muted-foreground">
          Esse pixel para de receber eventos imediatamente.
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
