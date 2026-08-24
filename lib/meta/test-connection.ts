import "server-only";
import { sendMetaEvents } from "./capi";

type PixelTestResult = { ok: boolean; message: string };

export async function testPixelConnection(
  pixelId: string,
  capiToken: string,
  testEventCode?: string,
): Promise<PixelTestResult> {
  const result = await sendMetaEvents(
    pixelId,
    capiToken,
    [
      {
        event_name: "TestConnection",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: "https://track.tanisexavierdezordi.com.br",
        user_data: {
          client_ip_address: "127.0.0.1",
          client_user_agent: "track.tanisexavierdezordi.com.br/test-connection",
        },
      },
    ],
    testEventCode,
  );

  if (!result.ok) {
    const body = result.body as { error?: { message?: string } };
    return { ok: false, message: body.error?.message ?? `HTTP ${result.status}` };
  }
  return {
    ok: true,
    message: testEventCode
      ? "Evento de teste enviado — confira em Test Events no Events Manager."
      : "Evento aceito pela Meta (defina um test_event_code nas configurações pra ver no Test Events sem contaminar dados reais).",
  };
}
