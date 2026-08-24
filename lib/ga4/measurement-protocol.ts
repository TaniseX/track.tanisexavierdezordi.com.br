import "server-only";

export type Ga4Event = { name: string; params?: Record<string, unknown> };

export type Ga4MpResult = { ok: boolean; status: number; body: unknown };

/**
 * Measurement Protocol — usar SÓ pra eventos que nascem fora do navegador
 * (ex: Purchase do webhook, Fase 4). Reusa o client_id (cookie _ga) e, se
 * houver, o session_id capturados na visita, pra cair na sessão certa.
 * Doc: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export async function sendGa4Event(
  measurementId: string,
  apiSecret: string,
  clientId: string,
  events: Ga4Event[],
  options?: { sessionId?: string | null },
): Promise<Ga4MpResult> {
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

  const body = {
    client_id: clientId,
    events: events.map((event) => ({
      name: event.name,
      params: {
        ...(options?.sessionId ? { session_id: options.sessionId } : {}),
        ...event.params,
      },
    })),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // O endpoint de collect real (não-debug) responde 204 sem corpo.
  const responseBody = res.status === 204 ? null : await res.json().catch(() => null);

  return { ok: res.ok, status: res.status, body: responseBody };
}
