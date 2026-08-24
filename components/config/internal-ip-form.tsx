"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addInternalIp } from "@/app/(dashboard)/configuracoes/trafego-interno/actions";

export function InternalIpForm() {
  const [state, action, pending] = useActionState(addInternalIp, undefined);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <Label htmlFor="ip">IP</Label>
        <Input id="ip" name="ip" placeholder="187.61.185.206" required className="font-mono" />
      </div>
      <div>
        <Label htmlFor="label">Rótulo (opcional)</Label>
        <Input id="label" name="label" placeholder="Ex: Matheus - casa" />
      </div>
      <Button type="submit" disabled={pending} className="shrink-0">
        {pending ? "Adicionando..." : "Adicionar"}
      </Button>
      {state?.error && <p className="text-sm text-destructive sm:col-span-3">{state.error}</p>}
    </form>
  );
}
