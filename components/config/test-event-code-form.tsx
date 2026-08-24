"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTestEventCode } from "@/app/(dashboard)/configuracoes/meta-pixels/actions";

export function TestEventCodeForm({ defaultValue }: { defaultValue: string | null }) {
  const [state, action, pending] = useActionState(updateTestEventCode, undefined);

  return (
    <form action={action} className="space-y-2">
      <Label htmlFor="meta_test_event_code">Meta test_event_code</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="meta_test_event_code"
          name="meta_test_event_code"
          defaultValue={defaultValue ?? ""}
          placeholder="Opcional — usado no botão &quot;Testar conexão&quot; de cada pixel"
          className="flex-1 font-mono text-xs"
        />
        <Button type="submit" variant="outline" size="sm" disabled={pending} className="shrink-0">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
