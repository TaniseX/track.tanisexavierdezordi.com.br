/**
 * Status/trigger conhecidos da Kiwify que contam como venda confirmada —
 * dispara Purchase. Baseado nos triggers documentados oficialmente
 * (docs.kiwify.com.br/api-reference/webhooks/create: "compra_aprovada" é o
 * nome do evento; "paid"/"approved" cobrem a possibilidade do campo
 * order_status vir com outro vocabulário). NÃO confirmado com payload real
 * — ajustar assim que uma venda de teste chegar (ver CLAUDE.md).
 */
const PURCHASE_TRIGGER_STATUSES = new Set(["compra_aprovada", "paid", "approved", "order_approved"]);

export function shouldTriggerPurchase(status: string): boolean {
  return PURCHASE_TRIGGER_STATUSES.has(status.trim().toLowerCase());
}
