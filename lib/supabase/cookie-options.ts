import type { CookieOptions } from "@supabase/ssr";

/**
 * @supabase/ssr não seta `secure` por padrão nos cookies de sessão. Força em
 * produção (HTTPS sempre, na Vercel) — sem isso, o cookie poderia em teoria
 * ser enviado por uma conexão HTTP não criptografada.
 */
export function secureCookieOptions(options: CookieOptions): CookieOptions {
  if (process.env.NODE_ENV === "production") {
    return { ...options, secure: true };
  }
  return options;
}
