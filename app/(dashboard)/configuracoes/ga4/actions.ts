"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSecret, updateSecret, readSecret } from "@/lib/vault/secrets";
import { ga4AccountSchema, ga4AccountUpdateSchema } from "@/lib/validation/config-schemas";
import { testGa4Connection } from "@/lib/ga4/test-connection";

export type Ga4ActionState = { error: string } | undefined;

export async function createGa4Account(
  _prev: Ga4ActionState,
  formData: FormData,
): Promise<Ga4ActionState> {
  const parsed = ga4AccountSchema.safeParse({
    label: formData.get("label"),
    measurement_id: formData.get("measurement_id"),
    api_secret: formData.get("api_secret"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const secretId = await createSecret(parsed.data.api_secret, `ga4:${parsed.data.measurement_id}`);
  const admin = createAdminClient();
  const { error } = await admin.from("ga4_accounts").insert({
    label: parsed.data.label,
    measurement_id: parsed.data.measurement_id,
    api_secret_id: secretId,
  });
  if (error) return { error: "Erro ao salvar: " + error.message };

  revalidatePath("/configuracoes/ga4");
  redirect("/configuracoes/ga4");
}

export async function updateGa4Account(
  id: string,
  _prev: Ga4ActionState,
  formData: FormData,
): Promise<Ga4ActionState> {
  const parsed = ga4AccountUpdateSchema.safeParse({
    label: formData.get("label"),
    measurement_id: formData.get("measurement_id"),
    api_secret: formData.get("api_secret") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();

  if (parsed.data.api_secret) {
    const { data: account } = await admin
      .from("ga4_accounts")
      .select("api_secret_id")
      .eq("id", id)
      .single();
    if (account) await updateSecret(account.api_secret_id, parsed.data.api_secret);
  }

  const { error } = await admin
    .from("ga4_accounts")
    .update({
      label: parsed.data.label,
      measurement_id: parsed.data.measurement_id,
      is_active: formData.get("is_active") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "Erro ao salvar: " + error.message };

  revalidatePath("/configuracoes/ga4");
  revalidatePath(`/configuracoes/ga4/${id}`);
  redirect("/configuracoes/ga4");
}

export async function deleteGa4Account(id: string) {
  const admin = createAdminClient();
  await admin.from("ga4_accounts").delete().eq("id", id);
  revalidatePath("/configuracoes/ga4");
  redirect("/configuracoes/ga4");
}

export async function testGa4Account(id: string) {
  const admin = createAdminClient();
  const { data: account } = await admin.from("ga4_accounts").select("*").eq("id", id).single();
  if (!account) return;

  const secret = await readSecret(account.api_secret_id);
  const result = await testGa4Connection(account.measurement_id, secret);

  await admin
    .from("ga4_accounts")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: result.ok ? "ok" : "error",
      last_test_message: result.message,
    })
    .eq("id", id);

  revalidatePath(`/configuracoes/ga4/${id}`);
  revalidatePath("/configuracoes/ga4");
}
