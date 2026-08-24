import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type Settings = {
  id: boolean;
  webhook_token_id: string | null;
  meta_test_event_code: string | null;
  currency: string;
  timezone: string;
  retention_days: number;
  updated_at: string;
};

/** settings é uma tabela singleton (id sempre true) — cria a linha se ainda não existir. */
export async function getSettings(): Promise<Settings> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("settings").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as Settings;

  const { data: created, error: createError } = await admin
    .from("settings")
    .insert({ id: true })
    .select("*")
    .single();
  if (createError) throw new Error(createError.message);
  return created as Settings;
}
