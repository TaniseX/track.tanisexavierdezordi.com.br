import "server-only";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashEmail, hashPhone, splitName } from "@/lib/meta/hashing";
import { dispatchEvent } from "@/lib/tracking/dispatch-event";
import { shouldTriggerPurchase } from "./status-map";
import { matchVisitor, type VisitorMatch } from "./match-visitor";
import type { GuruWebhookPayload } from "./webhook-schema";

function buildPhone(contact?: GuruWebhookPayload["contact"]): string | null {
  if (!contact?.phone_number) return null;
  return contact.phone_local_code ? `${contact.phone_local_code}${contact.phone_number}` : contact.phone_number;
}

export type ProcessPurchaseResult = {
  purchaseId: string;
  dispatched: boolean;
  matchMethod: string;
};

/**
 * Idempotente por guru_transaction_id (payload.id): reenvio do mesmo id
 * atualiza a linha mas só dispara Purchase uma vez (checa purchase_event_id).
 * Status fora de shouldTriggerPurchase (ex: refunded) só atualiza, não dispara.
 *
 * O disparo pro Meta/GA4 roda em segundo plano (waitUntil), depois da rota já
 * ter respondido — só a gravação no banco (rápida) acontece antes de
 * responder. As chamadas de rede pro Meta/GA4 encadeadas na mesma resposta
 * eram a causa provável de timeout de entrega do lado da Guru (ela não
 * reportava nem um código de erro, sinal de que a conexão nunca recebia
 * resposta a tempo).
 */
export async function processGuruPurchase(
  payload: GuruWebhookPayload,
  rawPayload: unknown,
): Promise<ProcessPurchaseResult> {
  const admin = createAdminClient();

  const transactionId = payload.id;
  const status = payload.status;
  const trckUserId = payload.source?.utm_term || null;
  const email = payload.contact?.email || null;
  const phone = buildPhone(payload.contact);

  const { data: existing } = await admin
    .from("purchases")
    .select("id, purchase_event_id")
    .eq("guru_transaction_id", transactionId)
    .maybeSingle();

  const match = await matchVisitor(admin, { trckUserId, email, phone });

  const grossValue = payload.payment?.gross ?? payload.payment?.total ?? null;

  const purchaseFields = {
    trck_user_id: trckUserId,
    visitor_id: match.visitor?.id ?? null,
    match_method: match.method,
    status,
    product_id: payload.product?.id ?? null,
    product_name: payload.product?.name ?? null,
    gross_value: grossValue,
    net_value: payload.payment?.net ?? null,
    currency: payload.payment?.currency ?? null,
    payment_method: payload.payment?.method ?? null,
    utm_source: payload.source?.utm_source ?? null,
    utm_medium: payload.source?.utm_medium ?? null,
    utm_campaign: payload.source?.utm_campaign ?? null,
    utm_term: payload.source?.utm_term ?? null,
    utm_content: payload.source?.utm_content ?? null,
    contact_name: payload.contact?.name ?? null,
    contact_email: email,
    contact_email_hash: email ? hashEmail(email) : null,
    contact_phone: phone,
    contact_phone_hash: phone ? hashPhone(phone) : null,
    ga_client_id: match.visitor?.ga_client_id ?? null,
    ga_session_id: match.visitor?.ga_session_id ?? null,
    fbp: match.visitor?.fbp ?? null,
    fbc: match.visitor?.fbc ?? null,
    raw_payload: rawPayload,
    ordered_at: payload.dates?.ordered_at ?? null,
    confirmed_at: payload.dates?.confirmed_at ?? null,
    canceled_at: payload.dates?.canceled_at ?? null,
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
        payload,
        transactionId,
        purchaseId,
        trckUserId,
        email,
        phone,
        grossValue,
        match,
      }).catch((err) => {
        console.error("Erro ao disparar Purchase em segundo plano:", err);
      }),
    );
  }

  return { purchaseId, dispatched: shouldDispatch, matchMethod: match.method };
}

async function dispatchPurchaseEvent(args: {
  admin: ReturnType<typeof createAdminClient>;
  payload: GuruWebhookPayload;
  transactionId: string;
  purchaseId: string;
  trckUserId: string | null;
  email: string | null;
  phone: string | null;
  grossValue: number | null;
  match: VisitorMatch;
}): Promise<void> {
  const { admin, payload, transactionId, purchaseId, trckUserId, email, phone, grossValue, match } = args;

  const eventId = `purchase-${transactionId}`;
  const value = grossValue ?? 0;
  const currency = payload.payment?.currency ?? "BRL";

  // Máximo de sinal pro Event Match Quality: nome (separado em fn/ln) e geo.
  // Pro geo, o endereço declarado pelo comprador (contact.address_*) é mais
  // preciso que geo por IP — cai pra infrastructure (geo do IP no momento da
  // compra) e por último pro geo do visitante casado (navegação anterior).
  const { firstName, lastName } = splitName(payload.contact?.name ?? "");
  const city = payload.contact?.address_city || payload.infrastructure?.city || match.visitor?.geo_city || null;
  const state = payload.contact?.address_state || payload.infrastructure?.region || match.visitor?.geo_region || null;
  const zip = payload.contact?.address_zip_code || null;
  const country =
    payload.contact?.address_country || payload.infrastructure?.country || match.visitor?.geo_country || null;

  const result = await dispatchEvent({
    ga4EventName: "purchase",
    metaEventName: "Purchase",
    eventId,
    ip: payload.infrastructure?.ip ?? null,
    userAgent: payload.infrastructure?.user_agent ?? null,
    userData: {
      email,
      phone,
      firstName,
      lastName,
      city,
      state,
      zip,
      country,
      fbp: match.visitor?.fbp,
      fbc: match.visitor?.fbc,
      externalId: trckUserId,
    },
    customData: {
      value,
      currency,
      content_ids: payload.product?.id ? [payload.product.id] : undefined,
      content_name: payload.product?.name,
      content_type: "product",
    },
    ga4Params: {
      transaction_id: transactionId,
      value,
      currency,
      items: payload.product ? [{ item_id: payload.product.id, item_name: payload.product.name }] : undefined,
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
      utm_source: payload.source?.utm_source ?? null,
      utm_medium: payload.source?.utm_medium ?? null,
      utm_campaign: payload.source?.utm_campaign ?? null,
      utm_term: payload.source?.utm_term ?? null,
      utm_content: payload.source?.utm_content ?? null,
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
