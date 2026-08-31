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
 * Campos abaixo CONFIRMADOS contra um payload real (teste enviado via botão
 * "Testar Webhook" da Kiwify, 2026-08-31 — ver CLAUDE.md): order_id, Customer
 * (full_name/first_name/email/mobile/ip/city/state/zipcode — sem country
 * explícito, assumido "BR"), Product.product_id/product_name,
 * Commissions.charge_amount/product_base_price/currency, order_status
 * ("paid"/"pending"/"refused"/"chargeback"/"refunded" — enum oficial da
 * OpenAPI spec), webhook_event_type ("order_approved" no teste),
 * TrackingParameters.{utm_source,utm_medium,utm_campaign,utm_term,utm_content,src,sck,s1,s2,s3},
 * created_at/approved_date (formato "YYYY-MM-DD HH:MM", sem timezone
 * explícito — Postgres aceita, assumido UTC).
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
  // utms — pendente do lado da LP). "src" é fallback pro campo de
  // rastreamento genérico que a Kiwify também aceita.
  const trckUserId = pickString(tracking, "utm_term") || pickString(tracking, "src") || null;
  const email = pickString(customer, "email");
  const phone = pickString(customer, "mobile", "phone");
  const name = pickString(customer, "full_name", "name");
  const ip = pickString(customer, "ip");
  const customerCity = pickString(customer, "city");
  const customerState = pickString(customer, "state");
  const customerZip = pickString(customer, "zipcode", "zip_code", "zip");
  // Sem campo de país explícito no Customer — Kiwify é uma plataforma
  // brasileira (CPF/CNPJ no payload), assumido "BR" quando o endereço do
  // comprador está presente.
  const customerCountry = customerCity || customerState ? "BR" : null;

  const { data: existing } = await admin
    .from("purchases")
    .select("id, purchase_event_id")
    .eq("guru_transaction_id", transactionId)
    .maybeSingle();

  const match = await matchVisitor(admin, { trckUserId, email, phone });

  // Valores monetários da Kiwify vêm em CENTAVOS (inferido: o exemplo oficial
  // da doc mostra charge_amount como inteiro sem casas decimais, e no
  // payload de teste real o valor batia com um plano de assinatura semanal
  // plausível só dividido por 100 — não documentado explicitamente em
  // nenhum lugar que consegui acessar). Ajustar aqui se uma venda real
  // mostrar que está errado (comparar Faturamento no painel vs valor real
  // mostrado no painel da Kiwify).
  const grossValueCents = pickNumber(commissions, "charge_amount", "product_base_price") ?? pickNumber(payload, "charge_amount", "price");
  const grossValue = grossValueCents !== null ? grossValueCents / 100 : null;
  const currency = pickString(commissions, "currency") ?? pickString(payload, "currency") ?? "BRL";
  const productId = pickString(product, "product_id", "id");
  const productName = pickString(product, "product_name", "name");
  const paymentMethod = pickString(payload, "payment_method");
  const orderedAt = pickString(payload, "created_at");
  const confirmedAt = pickString(payload, "approved_date");
  const canceledAt = pickString(payload, "refunded_at");

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
    // Endereço declarado pelo comprador (mais confiável) > geo do visitante
    // casado (navegação anterior) — mesma prioridade usada na Guru.
    geo_country: customerCountry ?? match.visitor?.geo_country ?? null,
    ga_client_id: match.visitor?.ga_client_id ?? null,
    ga_session_id: match.visitor?.ga_session_id ?? null,
    fbp: match.visitor?.fbp ?? null,
    fbc: match.visitor?.fbc ?? null,
    raw_payload: rawPayload,
    ordered_at: orderedAt,
    confirmed_at: confirmedAt,
    canceled_at: canceledAt,
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
        ip,
        city: customerCity,
        state: customerState,
        zip: customerZip,
        country: customerCountry,
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
  ip: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  productId: string | null;
  productName: string | null;
  grossValue: number | null;
  currency: string;
  match: VisitorMatch;
}): Promise<void> {
  const {
    admin,
    transactionId,
    purchaseId,
    trckUserId,
    email,
    phone,
    name,
    ip,
    productId,
    productName,
    grossValue,
    currency,
    match,
  } = args;

  const eventId = `purchase-${transactionId}`;
  const value = grossValue ?? 0;

  // Endereço declarado pelo comprador (Customer.*) > geo do visitante casado
  // (navegação anterior) — máximo de sinal pro Event Match Quality (fn/ln
  // via splitName, ct/st/zp/country, client_ip_address).
  const { firstName, lastName } = splitName(name ?? "");
  const city = args.city || match.visitor?.geo_city || null;
  const state = args.state || match.visitor?.geo_region || null;
  const country = args.country || match.visitor?.geo_country || null;

  const result = await dispatchEvent({
    ga4EventName: "purchase",
    metaEventName: "Purchase",
    eventId,
    ip,
    userAgent: null,
    userData: {
      email,
      phone,
      firstName,
      lastName,
      city,
      state,
      zip: args.zip,
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
      ip,
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
