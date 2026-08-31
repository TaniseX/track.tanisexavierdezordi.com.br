import "server-only";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashEmail, hashPhone, splitName } from "@/lib/meta/hashing";
import { dispatchEvent } from "@/lib/tracking/dispatch-event";
import { matchVisitor, type VisitorMatch } from "@/lib/guru/match-visitor";
import { shouldTriggerPurchase } from "./status-map";
import { pick, pickNumber, pickString, type KiwifyWebhookPayload } from "./webhook-schema";

export type ProcessPurchaseResult = {
  purchaseId: string;
  dispatched: boolean;
  matchMethod: string;
};

/**
 * Idempotente por transactionId (order_id da Kiwify): reenvio do mesmo id
 * atualiza a linha mas só dispara Purchase uma vez (checa purchase_event_id).
 * Mesmo padrão do processGuruPurchase (lib/guru/process-purchase.ts):
 * responde rápido (só grava no Postgres) e dispara pro Meta/GA4 depois via
 * waitUntil, fora do caminho crítico da resposta ao webhook.
 *
 * Reaproveita a coluna `purchases.guru_transaction_id` pra guardar o
 * order_id da Kiwify (nome da coluna ficou desatualizado — era só Guru
 * quando a tabela foi desenhada — mas como só um provedor de checkout está
 * ativo por vez, não há colisão; renomear exigiria migration nova, adiado).
 *
 * ATENÇÃO: extração de campos abaixo é best-effort (ver webhook-schema.ts) —
 * não validada contra um payload real da Kiwify ainda.
 */
export async function processKiwifyPurchase(
  payload: KiwifyWebhookPayload,
  rawPayload: unknown,
): Promise<ProcessPurchaseResult> {
  const admin = createAdminClient();

  const transactionId = pickString(payload, "order_id", "id", "order_ref");
  if (!transactionId) {
    throw new Error("Payload da Kiwify sem order_id/id — não é possível processar.");
  }

  const status = pickString(payload, "webhook_event_type", "order_status", "status") ?? "unknown";

  const customer = pick(payload, "Customer", "customer");
  const product = pick(payload, "Product", "product");
  const commissions = pick(payload, "Commissions", "commissions");
  const tracking = pick(payload, "TrackingParameters", "tracking_parameters", "trackingParameters");

  // utm_term carrega o trck_user_id, mesma convenção do link de checkout da
  // Guru (ver CLAUDE.md) — só funciona se o link de checkout da LP passar a
  // ser montado dinamicamente com essa utm (hoje é um link estático, sem
  // utms — pendente do lado da LP). "src" é um fallback pro campo de
  // rastreamento genérico que plataformas de checkout costumam ecoar.
  const trckUserId = pickString(tracking, "utm_term") || pickString(tracking, "src") || null;
  const email = pickString(customer, "email");
  const phone = pickString(customer, "mobile", "phone");
  const name = pickString(customer, "full_name", "name");

  const { data: existing } = await admin
    .from("purchases")
    .select("id, purchase_event_id")
    .eq("guru_transaction_id", transactionId)
    .maybeSingle();

  const match = await matchVisitor(admin, { trckUserId, email, phone });

  const grossValue = pickNumber(commissions, "charge_amount", "product_base_price") ?? pickNumber(payload, "charge_amount", "price");
  const currency = pickString(commissions, "currency") ?? pickString(payload, "currency") ?? "BRL";
  const productId = pickString(product, "product_id", "id");
  const productName = pickString(product, "product_name", "name");
  const paymentMethod = pickString(payload, "payment_method");

  const utmSource = pickString(tracking, "utm_source");
  const utmMedium = pickString(tracking, "utm_medium");
  const utmCampaign = pickString(tracking, "utm_campaign");
  const utmContent = pickString(tracking, "utm_content");

  const purchaseFields = {
    trck_user_id: trckUserId,
    visitor_id: match.visitor?.id ?? null,
    match_method: match.method,
    status,
    product_id: productId,
    product_name: productName,
    gross_value: grossValue,
    net_value: grossValue,
    currency,
    payment_method: paymentMethod,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_term: trckUserId,
    utm_content: utmContent,
    contact_name: name,
    contact_email: email,
    contact_email_hash: email ? hashEmail(email) : null,
    contact_phone: phone,
    contact_phone_hash: phone ? hashPhone(phone) : null,
    geo_country: match.visitor?.geo_country ?? null,
    ga_client_id: match.visitor?.ga_client_id ?? null,
    ga_session_id: match.visitor?.ga_session_id ?? null,
    fbp: match.visitor?.fbp ?? null,
    fbc: match.visitor?.fbc ?? null,
    raw_payload: rawPayload,
    updated_at: new Date().toISOString(),
  };

  let purchaseId: string;
  const alreadyDispatched = existing?.purchase_event_id != null;

  if (existing) {
    purchaseId = existing.id;
    await admin.from("purchases").update(purchaseFields).eq("id", purchaseId);
  } else {
    const { data: inserted, error } = await admin
      .from("purchases")
      .insert({ guru_transaction_id: transactionId, ...purchaseFields })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar purchase: ${error.message}`);
    purchaseId = inserted.id;
  }

  const shouldDispatch = shouldTriggerPurchase(status) && !alreadyDispatched;

  if (shouldDispatch) {
    waitUntil(
      dispatchPurchaseEvent({
        admin,
        transactionId,
        purchaseId,
        trckUserId,
        email,
        phone,
        name,
        productId,
        productName,
        grossValue,
        currency,
        match,
      }).catch((err) => {
        console.error("Erro ao disparar Purchase (Kiwify) em segundo plano:", err);
      }),
    );
  }

  return { purchaseId, dispatched: shouldDispatch, matchMethod: match.method };
}

async function dispatchPurchaseEvent(args: {
  admin: ReturnType<typeof createAdminClient>;
  transactionId: string;
  purchaseId: string;
  trckUserId: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
  productId: string | null;
  productName: string | null;
  grossValue: number | null;
  currency: string;
  match: VisitorMatch;
}): Promise<void> {
  const { admin, transactionId, purchaseId, trckUserId, email, phone, name, productId, productName, grossValue, currency, match } =
    args;

  const eventId = `purchase-${transactionId}`;
  const value = grossValue ?? 0;

  // Sem geo estruturado confirmado no payload da Kiwify (diferente da Guru,
  // que manda contact.address_*/infrastructure.*) — usa só o geo do
  // visitante casado (navegação anterior), quando há.
  const { firstName, lastName } = splitName(name ?? "");
  const city = match.visitor?.geo_city ?? null;
  const state = match.visitor?.geo_region ?? null;
  const country = match.visitor?.geo_country ?? null;

  const result = await dispatchEvent({
    ga4EventName: "purchase",
    metaEventName: "Purchase",
    eventId,
    ip: null,
    userAgent: null,
    userData: {
      email,
      phone,
      firstName,
      lastName,
      city,
      state,
      zip: null,
      country,
      fbp: match.visitor?.fbp,
      fbc: match.visitor?.fbc,
      externalId: trckUserId,
    },
    customData: {
      value,
      currency,
      content_ids: productId ? [productId] : undefined,
      content_name: productName ?? undefined,
      content_type: "product",
    },
    ga4Params: {
      transaction_id: transactionId,
      value,
      currency,
      items: productId ? [{ item_id: productId, item_name: productName ?? undefined }] : undefined,
    },
    ga4: {
      clientId: match.visitor?.ga_client_id,
      sessionId: match.visitor?.ga_session_id,
    },
    serverOnly: true,
  });

  const { data: eventRow } = await admin
    .from("events_log")
    .insert({
      event_id: eventId,
      event_name: "Purchase",
      trck_user_id: trckUserId,
      visitor_id: match.visitor?.id ?? null,
      value,
      currency,
      geo_country: country,
      geo_region: state,
      geo_city: city,
      status: result.status,
      payload_meta: result.payloadMeta,
      response_meta: result.responseMeta,
      payload_ga4: result.payloadGa4,
      response_ga4: result.responseGa4,
    })
    .select("id")
    .single();

  await admin.from("purchases").update({ purchase_event_id: eventRow?.id ?? null }).eq("id", purchaseId);
}
