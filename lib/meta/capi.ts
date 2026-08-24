import "server-only";
import { META_GRAPH_API_BASE_URL } from "./constants";

export type MetaEvent = Record<string, unknown>;

export type MetaCapiResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

/**
 * POST cru pra {pixel_id}/events da Graph API. Usada tanto pelo "testar
 * conexão" (Fase 2) quanto pelo disparo real de eventos (Fase 3/4).
 * Doc: https://developers.facebook.com/docs/marketing-api/conversions-api
 */
export async function sendMetaEvents(
  pixelId: string,
  accessToken: string,
  events: MetaEvent[],
  testEventCode?: string,
): Promise<MetaCapiResult> {
  const url = `${META_GRAPH_API_BASE_URL}/${pixelId}/events`;
  const payload: Record<string, unknown> = {
    data: events,
    access_token: accessToken,
  };
  if (testEventCode) payload.test_event_code = testEventCode;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  const ok = res.ok && !(body as { error?: unknown }).error;

  return { ok, status: res.status, body };
}
