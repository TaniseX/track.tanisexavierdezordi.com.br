"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type InternalIpActionState = { error: string } | undefined;

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+:[0-9a-fA-F:]*$/;

const addSchema = z.object({
  ip: z
    .string()
    .trim()
    .refine((v) => IPV4_RE.test(v) || IPV6_RE.test(v), {
      error: "IP inválido (use o formato v4 ou v6, sem porta).",
    }),
  label: z.string().trim().max(120).optional(),
});

export async function addInternalIp(
  _prev: InternalIpActionState,
  formData: FormData,
): Promise<InternalIpActionState> {
  const parsed = addSchema.safeParse({
    ip: formData.get("ip"),
    label: formData.get("label") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("internal_ips")
    .insert({ ip: parsed.data.ip, label: parsed.data.label ?? null });
  if (error) {
    return {
      error: error.code === "23505" ? "Esse IP já está cadastrado." : "Erro ao salvar: " + error.message,
    };
  }

  revalidatePath("/configuracoes/trafego-interno");
}

export async function removeInternalIp(id: string) {
  const admin = createAdminClient();
  await admin.from("internal_ips").delete().eq("id", id);
  revalidatePath("/configuracoes/trafego-interno");
}
