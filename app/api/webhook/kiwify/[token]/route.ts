import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSettings } from "@/lib/config/settings";
import { readSecret } from "@/lib/vault/secrets";
import { kiwifyWebhookSchema, pickString } from "@/lib/kiwify/webhook-schema";
import { processKiwifyPurchase } from "@/lib/kiwify/process-purchase";
import { isInternalIp } from "@/lib/tracking/internal-ips";
import { isMetaBotTraffic } from "@/lib/tracking/meta-bot-traffic";

/**
 * Webhook de pedido da Kiwify. Mesmo padrão de segurança do webhook da Guru
 * (app/api/webhook/guru/[token]/route.ts): o token vem no PATH, não em query
 * string nem em algum mecanismo de assinatura da própria Kiwify — quem
 * protege esse endpoint é o segredo na URL, não a Kiwify. Reaproveita o
 * MESMO webhook_token_id já cadastrado em Configurações (não é um segredo
 * separado por provedor — só precisa ser imprevisível).
 *
 * Pra ativar: em Kiwify → Configurações → Webhooks → Criar webhook, colar
 * como URL de destino:
 *   https://track.tanisexavierdezordi.com.br/api/webhook/kiwify/<token>
 * (o mesmo token mostrado em Configurações do painel, na URL do webhook da
 * Guru — é literalmente a mesma string, só muda o path).
 */
function tokensMatch(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/webhook/kiwify/[token]">) {
  const { token } = await ctx.params;

  const settings = await getSettings();
  if (!settings.webhook_token_id) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const expectedToken = await readSecret(settings.webhook_token_id);
  if (!token || !tokensMatch(token, expectedToken)) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = kiwifyWebhookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inesperado." }, { status: 400 });
  }

  // Sem campo de IP/user-agent confirmado no payload da Kiwify — tenta os
  // nomes mais prováveis; se nenhum existir, os checks abaixo simplesmente
  // não filtram nada (isInternalIp/isMetaBotTraffic tratam null como "não é").
  const customer = parsed.data["Customer"] ?? parsed.data["customer"];
  const ip = pickString(customer, "ip") ?? pickString(parsed.data, "ip", "customer_ip");

  if (await isInternalIp(ip)) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (await isMetaBotTraffic(ip, null)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await processKiwifyPurchase(parsed.data, json);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Erro ao processar webhook Kiwify:", err);
    return NextResponse.json({ error: "Erro ao processar." }, { status: 500 });
  }
}
