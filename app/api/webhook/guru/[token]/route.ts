import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSettings } from "@/lib/config/settings";
import { readSecret } from "@/lib/vault/secrets";
import { guruWebhookSchema } from "@/lib/guru/webhook-schema";
import { processGuruPurchase } from "@/lib/guru/process-purchase";
import { isInternalIp } from "@/lib/tracking/internal-ips";
import { isMetaBotTraffic } from "@/lib/tracking/meta-bot-traffic";

/** Compara hashes (mesmo tamanho sempre) em vez dos tokens crus — evita
 * timing attack E o throw do timingSafeEqual quando os buffers têm tamanhos
 * diferentes. */
function tokensMatch(a: string, b: string): boolean {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/webhook/guru/[token]">) {
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

  const parsed = guruWebhookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Tráfego interno (equipe testando o próprio funil, ex: compra de teste):
  // confirma pra Guru sem criar/atualizar purchase nem disparar pro Meta/GA4.
  if (await isInternalIp(parsed.data.infrastructure?.ip ?? null)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Bot/IP da própria Meta (raro num webhook de compra, mas mesma proteção
  // por consistência — usa o IP/UA do comprador informado pela Guru).
  if (
    await isMetaBotTraffic(
      parsed.data.infrastructure?.ip ?? null,
      parsed.data.infrastructure?.user_agent ?? null,
    )
  ) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const result = await processGuruPurchase(parsed.data, json);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Erro ao processar webhook Guru:", err);
    return NextResponse.json({ error: "Erro ao processar." }, { status: 500 });
  }
}
