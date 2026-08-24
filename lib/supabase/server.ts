import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublishableKey, getSupabaseUrl } from "./env";
import { secureCookieOptions } from "./cookie-options";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Respeita RLS (usa a publishable key). Criar uma instância nova por request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, secureCookieOptions(options)),
          );
        } catch {
          // Chamado a partir de um Server Component (sem acesso de escrita a
          // cookies). O refresh de sessão já é tratado pelo proxy.ts.
        }
      },
    },
  });
}
