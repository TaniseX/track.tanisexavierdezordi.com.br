import "server-only";
import { geolocation } from "@vercel/functions";
import type { NextRequest } from "next/server";

export type Geo = {
  country: string | null;
  region: string | null;
  city: string | null;
  postalCode: string | null;
};

/**
 * A Vercel injeta os headers x-vercel-ip-* automaticamente em prod/preview.
 * Não funciona em `next dev` local — degrada graciosamente pra geo null.
 */
export function getGeo(request: NextRequest): Geo {
  const geo = geolocation(request);
  return {
    country: geo.country ?? null,
    region: geo.countryRegion ?? null,
    city: geo.city ?? null,
    postalCode: geo.postalCode ?? null,
  };
}
