import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashEmail, hashPhone } from "@/lib/meta/hashing";

export type MatchMethod = "trck_user_id" | "email" | "phone" | "unmatched";

type MatchInput = {
  trckUserId?: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * Matching em cascata: trck_user_id (utm_term do checkout) → email → telefone
 * → unmatched. Continua e dispara Purchase mesmo sem match — só com o que a
 * Guru forneceu.
 */
export async function matchVisitor(admin: SupabaseClient, input: MatchInput) {
  if (input.trckUserId) {
    const { data } = await admin
      .from("visitors")
      .select("*")
      .eq("trck_user_id", input.trckUserId)
      .maybeSingle();
    if (data) return { visitor: data, method: "trck_user_id" as MatchMethod };
  }

  if (input.email) {
    const { data } = await admin
      .from("visitors")
      .select("*")
      .eq("email_hash", hashEmail(input.email))
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return { visitor: data, method: "email" as MatchMethod };
  }

  if (input.phone) {
    const { data } = await admin
      .from("visitors")
      .select("*")
      .eq("phone_hash", hashPhone(input.phone))
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return { visitor: data, method: "phone" as MatchMethod };
  }

  return { visitor: null, method: "unmatched" as MatchMethod };
}

export type VisitorMatch = Awaited<ReturnType<typeof matchVisitor>>;
