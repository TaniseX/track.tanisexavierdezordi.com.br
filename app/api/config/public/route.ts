import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Config pública pro tracker.js carregar o gtag.js e o Meta Pixel base code
 * dinamicamente. measurement_id/pixel_id não são segredos (já ficam visíveis
 * em qualquer página que use GA4/Meta Pixel) — CORS liberado geral.
 */
export async function GET() {
  const admin = createAdminClient();
  const [ga4, pixels] = await Promise.all([
    admin.from("ga4_accounts").select("measurement_id").eq("is_active", true),
    admin.from("meta_pixels").select("pixel_id").eq("is_active", true),
  ]);

  return NextResponse.json(
    {
      ga4_measurement_ids: (ga4.data ?? []).map((a) => a.measurement_id),
      meta_pixel_ids: (pixels.data ?? []).map((p) => p.pixel_id),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    },
  );
}
