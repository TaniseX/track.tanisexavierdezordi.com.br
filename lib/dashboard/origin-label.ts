/**
 * Fallback de "Origem" na aba Eventos quando não há utm nenhuma (nem
 * campanha/anúncio resolvido, nem utm_campaign/utm_content/utm_source cru):
 * mostra de onde o visitante veio (referrer do primeiro acesso, gravado em
 * visitors.referrer) ou "Direto" quando não há referrer (digitou a URL,
 * favorito, app nativo sem referrer etc).
 */
export function originFromReferrer(referrer: string | null | undefined): string {
  if (!referrer) return "Direto";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return `Referência: ${host}`;
  } catch {
    return "Referência";
  }
}
