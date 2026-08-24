"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AccountFormState = { error: string } | undefined;

export function AccountForm({
  action,
  identifierLabel,
  identifierName,
  identifierPlaceholder,
  secretLabel,
  secretName,
  defaultLabel,
  defaultIdentifier,
  secretIsSet,
  showActiveToggle,
  defaultIsActive,
  submitLabel,
}: {
  action: (prevState: AccountFormState, formData: FormData) => Promise<AccountFormState>;
  identifierLabel: string;
  identifierName: string;
  identifierPlaceholder: string;
  secretLabel: string;
  secretName: string;
  defaultLabel?: string;
  defaultIdentifier?: string;
  secretIsSet?: boolean;
  showActiveToggle?: boolean;
  defaultIsActive?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="label">Nome</Label>
        <Input
          id="label"
          name="label"
          defaultValue={defaultLabel}
          required
          placeholder="Ex: Pixel principal"
        />
      </div>
      <div>
        <Label htmlFor={identifierName}>{identifierLabel}</Label>
        <Input
          id={identifierName}
          name={identifierName}
          defaultValue={defaultIdentifier}
          required
          placeholder={identifierPlaceholder}
          className="font-mono"
        />
      </div>
      <div>
        <Label htmlFor={secretName}>{secretLabel}</Label>
        <Input
          id={secretName}
          name={secretName}
          type="password"
          required={!secretIsSet}
          placeholder={secretIsSet ? "•••• deixe em branco pra manter o atual" : undefined}
          className="font-mono"
          autoComplete="off"
        />
      </div>

      {showActiveToggle && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={defaultIsActive ?? true}
            className="h-4 w-4 rounded border-input"
          />
          Ativo (recebe os eventos disparados)
        </label>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
