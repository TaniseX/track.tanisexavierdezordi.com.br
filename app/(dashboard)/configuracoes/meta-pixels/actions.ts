"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSecret, updateSecret, readSecret } from "@/lib/vault/secrets";
import {
  metaPixelSchema,
  metaPixelUpdateSchema,
  testEventCodeSchema,
} from "@/lib/validation/config-schemas";
import { testPixelConnection } from "@/lib/meta/test-connection";
import { getSettings } from "@/lib/config/settings";

export type MetaPixelActionState = { error: string } | undefined;

export async function updateTestEventCode(
  _prev: MetaPixelActionState,
  formData: FormData,
): Promise<MetaPixelActionState> {
  const parsed = testEventCodeSchema.safeParse({
    meta_test_event_code: formData.get("meta_test_event_code") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("settings")
    .update({
      meta_test_event_code: parsed.data.meta_test_event_code || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { error: "Erro ao salvar: " + error.message };

  revalidatePath("/configuracoes/meta-pixels");
}

export async function createMetaPixel(
  _prev: MetaPixelActionState,
  formData: FormData,
): Promise<MetaPixelActionState> {
  const parsed = metaPixelSchema.safeParse({
    label: formData.get("label"),
    pixel_id: formData.get("pixel_id"),
    capi_token: formData.get("capi_token"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const secretId = await createSecret(parsed.data.capi_token, `meta_pixel:${parsed.data.pixel_id}`);
  const admin = createAdminClient();
  const { error } = await admin.from("meta_pixels").insert({
    label: parsed.data.label,
    pixel_id: parsed.data.pixel_id,
    capi_token_id: secretId,
  });
  if (error) return { error: "Erro ao salvar: " + error.message };

  revalidatePath("/configuracoes/meta-pixels");
  redirect("/configuracoes/meta-pixels");
}

export async function updateMetaPixel(
  id: string,
  _prev: MetaPixelActionState,
  formData: FormData,
): Promise<MetaPixelActionState> {
  const parsed = metaPixelUpdateSchema.safeParse({
    label: formData.get("label"),
    pixel_id: formData.get("pixel_id"),
    capi_token: formData.get("capi_token") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();

  if (parsed.data.capi_token) {
    const { data: pixel } = await admin
      .from("meta_pixels")
      .select("capi_token_id")
      .eq("id", id)
      .single();
    if (pixel) await updateSecret(pixel.capi_token_id, parsed.data.capi_token);
  }

  const { error } = await admin
    .from("meta_pixels")
    .update({
      label: parsed.data.label,
      pixel_id: parsed.data.pixel_id,
      is_active: formData.get("is_active") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "Erro ao salvar: " + error.message };

  revalidatePath("/configuracoes/meta-pixels");
  revalidatePath(`/configuracoes/meta-pixels/${id}`);
  redirect("/configuracoes/meta-pixels");
}

export async function deleteMetaPixel(id: string) {
  const admin = createAdminClient();
  await admin.from("meta_pixels").delete().eq("id", id);
  revalidatePath("/configuracoes/meta-pixels");
  redirect("/configuracoes/meta-pixels");
}

export async function testMetaPixel(id: string) {
  const admin = createAdminClient();
  const { data: pixel } = await admin.from("meta_pixels").select("*").eq("id", id).single();
  if (!pixel) return;

  const token = await readSecret(pixel.capi_token_id);
  const settings = await getSettings();
  const result = await testPixelConnection(
    pixel.pixel_id,
    token,
    settings.meta_test_event_code ?? undefined,
  );

  await admin
    .from("meta_pixels")
    .update({
      last_tested_at: new Date().toISOString(),
      last_test_status: result.ok ? "ok" : "error",
      last_test_message: result.message,
    })
    .eq("id", id);

  revalidatePath(`/configuracoes/meta-pixels/${id}`);
  revalidatePath("/configuracoes/meta-pixels");
}
