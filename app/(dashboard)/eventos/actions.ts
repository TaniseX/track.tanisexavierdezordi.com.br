"use server";

import { createClient } from "@/lib/supabase/server";

export type VisitorEventRow = {
  id: string;
  event_id: string;
  event_name: string;
  status: string;
  value: number | null;
  currency: string | null;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  payload_meta: unknown;
  response_meta: unknown;
  payload_ga4: unknown;
  response_ga4: unknown;
};

export type VisitorProfile = {
  id: string;
  trck_user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_url: string | null;
  fbp: string | null;
  fbc: string | null;
  ga_client_id: string | null;
  ga_session_id: string | null;
  ip: string | null;
  user_agent: string | null;
  geo_country: string | null;
  geo_region: string | null;
  geo_city: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export type VisitorDetail = {
  visitor: VisitorProfile | null;
  events: VisitorEventRow[];
};

// Server Action (não Route Handler): páginas do dashboard já usam
// lib/supabase/server.ts (respeita RLS, role authenticated) — mesma defesa
// em profundidade das outras páginas, sem precisar de check de auth manual.
export async function getVisitorDetail(trckUserId: string): Promise<VisitorDetail> {
  const supabase = await createClient();

  const [{ data: visitor }, { data: events }] = await Promise.all([
    supabase.from("visitors").select("*").eq("trck_user_id", trckUserId).maybeSingle(),
    supabase
      .from("events_log")
      .select(
        "id, event_id, event_name, status, value, currency, created_at, utm_source, utm_medium, utm_campaign, utm_term, utm_content, payload_meta, response_meta, payload_ga4, response_ga4",
      )
      .eq("trck_user_id", trckUserId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    visitor: (visitor as VisitorProfile) ?? null,
    events: (events as VisitorEventRow[]) ?? [],
  };
}
