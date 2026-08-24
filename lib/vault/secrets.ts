import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Wrappers do Supabase Vault (via as functions públicas em
 * supabase/migrations/0006_vault_helpers.sql). Uso exclusivo server-side.
 */

export async function createSecret(value: string, name?: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_secret", {
    secret_value: value,
    secret_name: name ?? null,
  });
  if (error) throw new Error(`Falha ao criar segredo no Vault: ${error.message}`);
  return data as string;
}

export async function updateSecret(id: string, value: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("update_secret", { secret_id: id, secret_value: value });
  if (error) throw new Error(`Falha ao atualizar segredo no Vault: ${error.message}`);
}

export async function readSecret(id: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("read_secret", { secret_id: id });
  if (error) throw new Error(`Falha ao ler segredo no Vault: ${error.message}`);
  return data as string;
}

export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
