import { z } from "zod";

/**
 * Payload do webhook de pedido da Kiwify.
 *
 * IMPORTANTE — construído SEM um payload real de confirmação (a doc oficial
 * da Kiwify pra isso fica parte num Notion não indexado, não foi possível
 * confirmar 100% dos nomes de campo). Por isso, ao contrário do
 * guruWebhookSchema (que valida a forma exata dos campos), este schema é
 * deliberadamente frouxo: só garante que o corpo é um objeto, não rejeita
 * nada por formato de campo. Toda a extração de campo em process-purchase.ts
 * é defensiva (tenta múltiplos nomes/variações de capitalização possíveis).
 * `raw_payload` em `purchases` sempre guarda o JSON original, então nenhum
 * dado é perdido mesmo se a extração abaixo errar o nome de um campo.
 *
 * AJUSTAR assim que um payload real (venda de teste ou o botão "Testar
 * Webhook" no painel da Kiwify) for capturado — ver CLAUDE.md.
 */
export const kiwifyWebhookSchema = z.record(z.string(), z.unknown());

export type KiwifyWebhookPayload = z.infer<typeof kiwifyWebhookSchema>;

/** Lê um campo tentando múltiplas variações de nome/capitalização — a Kiwify
 * mistura snake_case (order_id, order_status) com PascalCase pros objetos
 * aninhados (Customer, Product, TrackingParameters) em exemplos vistos, mas
 * isso não está 100% confirmado pra todos os campos. */
export function pick(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

export function pickString(obj: unknown, ...keys: string[]): string | null {
  const value = pick(obj, ...keys);
  if (value === undefined || value === null) return null;
  return String(value);
}

export function pickNumber(obj: unknown, ...keys: string[]): number | null {
  const value = pick(obj, ...keys);
  if (value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
