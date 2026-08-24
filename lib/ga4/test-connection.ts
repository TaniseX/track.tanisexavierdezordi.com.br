import "server-only";

type Ga4TestResult = { ok: boolean; message: string };

/**
 * Usa o endpoint de debug do GA4 Measurement Protocol: valida measurement_id
 * + api_secret sem contabilizar o evento nos relatórios reais.
 * Doc: https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events
 */
export async function testGa4Connection(
  measurementId: string,
  apiSecret: string,
): Promise<Ga4TestResult> {
  try {
    const url = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "track-tanisexavierdezordi.test-connection",
        events: [{ name: "test_connection", params: {} }],
      }),
    });

    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status} — verifique measurement_id/api_secret.` };
    }

    const body = (await res.json()) as { validationMessages?: { description: string }[] };
    const messages = body.validationMessages ?? [];
    if (messages.length === 0) {
      return { ok: true, message: "Conexão validada com sucesso." };
    }
    return { ok: false, message: messages.map((m) => m.description).join("; ") };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Erro de rede." };
  }
}
