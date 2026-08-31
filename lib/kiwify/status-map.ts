/**
 * Status/trigger conhecidos da Kiwify que contam como venda confirmada —
 * dispara Purchase. CONFIRMADO contra a OpenAPI spec oficial
 * (docs.kiwify.com.br/api-reference/openapi.json): enum de status de venda
 * é `paid | pending | refused | chargeback | refunded` (campo order_status);
 * `webhook_event_type` usa vocabulário próprio, confirmado "order_approved"
 * num payload de teste real (2026-08-31). "compra_aprovada"/"approved"
 * mantidos como fallback (nome do trigger na criação do webhook, caso
 * apareça em algum payload também).
 */
const PURCHASE_TRIGGER_STATUSES = new Set(["paid", "order_approved", "compra_aprovada", "approved"]);

export function shouldTriggerPurchase(status: string): boolean {
  return PURCHASE_TRIGGER_STATUSES.has(status.trim().toLowerCase());
}
