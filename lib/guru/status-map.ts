/**
 * Status conhecidos da Guru que contam como venda confirmada — dispara
 * Purchase. Ajustar depois de validar com uma venda de teste real (ver
 * CLAUDE.md, risco já sinalizado no plano).
 */
const PURCHASE_TRIGGER_STATUSES = new Set(["approved", "confirmed"]);

export function shouldTriggerPurchase(status: string): boolean {
  return PURCHASE_TRIGGER_STATUSES.has(status.trim().toLowerCase());
}
