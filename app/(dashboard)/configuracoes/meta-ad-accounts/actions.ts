"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSecret, updateSecret, readSecret } from "@/lib/vault/secrets";
import {
  metaAdAccountSchema,
  metaAdAccountUpdateSchema,
} from "@/lib/validation/config-schemas";
import { testAdAccountConnection } from "@/lib/meta/ad-accounts";

export type MetaAdAccountActionState = { error: string } | undefined;

export async function createMetaAdAccount(
  _prev: MetaAdAccountActionState,
  formData: FormData,
): Promise<MetaAdAccountActionState> {
  const parsed = metaAdAccountSchema.safeParse({
    label: formData.get("label"),
    ad_account_id: formData.get("ad_account_id"),
    access_token: formData.get("access_token"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const secretId = await createSecret(
    parsed.data.access_token,
    `meta_ad_account:${parsed.data.ad_account_id}`,
  );
  const admin = createAdminClient();
  const { error } = await admin.from("meta_ad_accounts").insert({
    label: parsed.data.label,
    ad_account_id: parsed.data.ad_account_id,
    access_token_id: secretId,
  });
  if (error) return { error: "Erro ao salvar: " + error.message };

  revalidatePath("/configuracoes/meta-ad-accounts");
  redirect("/configuracoes/meta-ad-accounts");
}

export async function updateMetaAdAccount(
  id: string,
  _prev: MetaAdAccountActionState,
  formData: FormData,
): Promise<MetaAdAccountActionState> {
  const parsed = metaAdAccountUpdateSchema.safeParse({
    label: formData.get("label"),
    ad_account_id: formData.get("ad_account_id"),
    access_token: formData.get("access_token") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();

  if (parsed.data.access_token) {
    const { data: account } = await admin
      .from("meta_ad_accounts")
      .select("access_token_id")
      .eq("id", id)
      .single();
    if (account) await updateSecret(account.access_token_id, parsed.data.access_token);
  }

  const { error } = await admin
    .from("meta_ad_accounts")
    .update({
      label: parsed.data.label,
      ad_account_id: parsed.data.ad_account_id,
      is_active: formData.get("is_active") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "Erro ao salvar: " + error.message };

  revalidatePath("/configuracoes/meta-ad-accounts");
  revalidatePath(`/configuracoes/meta-ad-accounts/${id}`);
  redirect("/configuracoes/meta-ad-accounts");
}

export async function deleteMetaAdAccount(id: string) {
  const admin = createAdminClient();
  await admin.from("meta_ad_accounts").delete().eq("id", id);
  revalidatePath("/configuracoes/meta-ad-accounts");
  redirect("/configuracoes/meta-ad-accounts");
}

export async function testMetaAdAccount(id: string) {
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("meta_ad_accounts")
    .select("*")
    .eq("id", id)
    .single();
  if (!account) return;

  const token = await readSecret(account.access_token_id);
  const result = await testAdAccountConnection(account.ad_account_id, token);

  await admin
    .from("meta_ad_accounts")
    .update({
      last_synced_at: new Date().toISOString(),
      last_test_status: result.ok ? "ok" : "error",
      last_test_message: result.message,
    })
    .eq("id", id);

  revalidatePath(`/configuracoes/meta-ad-accounts/${id}`);
  revalidatePath("/configuracoes/meta-ad-accounts");
}
