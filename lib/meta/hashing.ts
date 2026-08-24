import { createHash } from "node:crypto";

/**
 * SHA-256 lowercase/trim, como exigido pelos parâmetros de customer
 * information da Conversions API. NUNCA usar em fbp/fbc/client_ip_address/
 * client_user_agent — esses vão em texto puro.
 * https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */
export function sha256Lower(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function hashEmail(email: string): string {
  return sha256Lower(email);
}

/** Telefone: só dígitos antes de hashear (sem +, espaços, parênteses, hífen). */
export function hashPhone(phone: string): string {
  return sha256Lower(phone.replace(/\D/g, ""));
}

/** Remove acentos — a normalização da Meta trata "André"/"São Paulo" como "andre"/"sao paulo". */
function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** fn/ln: sem acento, minúsculo, sem espaço nas pontas — mantém espaço interno (sobrenome composto). */
export function hashName(name: string): string {
  return sha256Lower(stripAccents(name));
}

/** Primeiro nome = 1º token; sobrenome = resto. Ex: "Alexandre Renisz" -> fn="alexandre" ln="renisz". */
export function splitName(fullName: string): { firstName: string | null; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

/** ct: sem acento, minúsculo, SEM espaço nenhum — a Meta normaliza "New York City" -> "newyorkcity". */
export function hashCity(city: string): string {
  return sha256Lower(stripAccents(city).replace(/\s+/g, ""));
}

/** st: sigla do estado (ex: "PR"), sem acento/espaço. */
export function hashState(state: string): string {
  return sha256Lower(stripAccents(state).replace(/\s+/g, ""));
}

/** zp: CEP sem espaço. */
export function hashZip(zip: string): string {
  return sha256Lower(stripAccents(zip).replace(/\s+/g, ""));
}

/** country: código ISO de 2 letras (ex: "BR"), minúsculo. */
export function hashCountry(country: string): string {
  return sha256Lower(stripAccents(country).replace(/\s+/g, ""));
}
