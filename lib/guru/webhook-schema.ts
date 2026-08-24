import { z } from "zod";

// A Guru manda `null` explícito (não omite o campo) em vários opcionais sem
// valor — ex: dates.canceled_at antes de cancelar, source.utm_* quando a
// venda não veio de um link com utm. `.optional()` sozinho só aceita o campo
// *ausente* (undefined), rejeita `null` com "Invalid input: expected string,
// received null". `.nullable()` cobre os dois casos — process-purchase.ts já
// trata ausência de valor com `?? null`/`||` normalmente, então não muda a
// lógica, só para de rejeitar o payload real da Guru.
const nullableString = () => z.string().nullable().optional();
const nullableNumber = () => z.coerce.number().nullable().optional();

/**
 * Payload do webhook de transação da Guru (docs.digitalmanager.guru).
 * .passthrough() preserva campos não mapeados — o raw_payload salvo em
 * purchases é sempre o JSON original, não este objeto parseado.
 */
export const guruWebhookSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform((v) => String(v)),
    status: z.string().min(1),
    contact: z
      .object({
        name: nullableString(),
        email: nullableString(),
        phone_number: nullableString(),
        phone_local_code: nullableString(),
        address_city: nullableString(),
        address_state: nullableString(),
        address_zip_code: nullableString(),
        address_country: nullableString(),
      })
      .optional(),
    product: z
      .object({
        id: z
          .union([z.string(), z.number()])
          .transform((v) => String(v))
          .nullable()
          .optional(),
        name: nullableString(),
      })
      .optional(),
    payment: z
      .object({
        total: nullableNumber(),
        gross: nullableNumber(),
        net: nullableNumber(),
        currency: nullableString(),
        method: nullableString(),
      })
      .optional(),
    dates: z
      .object({
        created_at: nullableString(),
        ordered_at: nullableString(),
        confirmed_at: nullableString(),
        canceled_at: nullableString(),
      })
      .optional(),
    source: z
      .object({
        utm_source: nullableString(),
        utm_medium: nullableString(),
        utm_campaign: nullableString(),
        utm_term: nullableString(),
        utm_content: nullableString(),
      })
      .optional(),
    infrastructure: z
      .object({
        ip: nullableString(),
        user_agent: nullableString(),
        city: nullableString(),
        region: nullableString(),
        country: nullableString(),
      })
      .optional(),
  })
  .passthrough();

export type GuruWebhookPayload = z.infer<typeof guruWebhookSchema>;
