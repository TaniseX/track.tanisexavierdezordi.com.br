import { z } from "zod";

export const settingsSchema = z.object({
  currency: z
    .string()
    .trim()
    .length(3, { error: "Use o código ISO 4217 (ex: BRL)." })
    .toUpperCase(),
  timezone: z.string().trim().min(1, { error: "Informe o timezone." }),
  retention_days: z.coerce
    .number({ error: "Informe um número." })
    .int()
    .min(1, { error: "Mínimo de 1 dia." }),
});

export const testEventCodeSchema = z.object({
  meta_test_event_code: z.string().trim().optional(),
});

export const ga4AccountSchema = z.object({
  label: z.string().trim().min(1, { error: "Informe um nome." }),
  measurement_id: z
    .string()
    .trim()
    .regex(/^G-[A-Z0-9]+$/i, { error: "Formato esperado: G-XXXXXXX." }),
  api_secret: z.string().trim().min(1, { error: "Informe o API secret." }),
});

export const ga4AccountUpdateSchema = ga4AccountSchema.extend({
  api_secret: z.string().trim().optional(),
});

export const metaPixelSchema = z.object({
  label: z.string().trim().min(1, { error: "Informe um nome." }),
  pixel_id: z.string().trim().regex(/^\d+$/, { error: "O Pixel ID só tem dígitos." }),
  capi_token: z.string().trim().min(1, { error: "Informe o token da Conversions API." }),
});

export const metaPixelUpdateSchema = metaPixelSchema.extend({
  capi_token: z.string().trim().optional(),
});

export const metaAdAccountSchema = z.object({
  label: z.string().trim().min(1, { error: "Informe um nome." }),
  ad_account_id: z
    .string()
    .trim()
    .regex(/^(act_)?\d+$/, { error: "Formato esperado: act_XXXXXXXXX." })
    .transform((value) => (value.startsWith("act_") ? value : `act_${value}`)),
  access_token: z.string().trim().min(1, { error: "Informe o access token." }),
});

export const metaAdAccountUpdateSchema = metaAdAccountSchema.extend({
  access_token: z.string().trim().optional(),
});
