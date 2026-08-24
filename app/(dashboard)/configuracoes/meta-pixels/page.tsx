import { Card } from "@/components/ui/card";
import { AccountList } from "@/components/config/account-list";
import { TestEventCodeForm } from "@/components/config/test-event-code-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/config/settings";

export default async function MetaPixelsListPage() {
  const admin = createAdminClient();
  const [{ data }, settings] = await Promise.all([
    admin.from("meta_pixels").select("*").order("created_at", { ascending: false }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pixels Meta</h1>
        <p className="text-sm text-muted-foreground">
          Pixels que recebem eventos via Conversions API.
        </p>
      </div>

      <Card className="space-y-2 p-4">
        <TestEventCodeForm defaultValue={settings.meta_test_event_code} />
      </Card>

      <AccountList
        items={(data ?? []).map((p) => ({
          id: p.id,
          label: p.label,
          identifier: p.pixel_id,
          isActive: p.is_active,
          lastTestStatus: p.last_test_status,
        }))}
        basePath="/configuracoes/meta-pixels"
        identifierLabel="Pixel ID"
        emptyMessage="Nenhum pixel cadastrado ainda."
      />
    </div>
  );
}
