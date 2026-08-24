import "server-only";
import { META_GRAPH_API_BASE_URL } from "./constants";

type AdAccountTestResult = { ok: boolean; message: string };

export async function testAdAccountConnection(
  adAccountId: string,
  accessToken: string,
): Promise<AdAccountTestResult> {
  try {
    const url = `${META_GRAPH_API_BASE_URL}/${adAccountId}?fields=name,account_status&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const body = await res.json();

    if (!res.ok || body.error) {
      return { ok: false, message: body.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, message: `Conectado: ${body.name}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Erro de rede." };
  }
}
