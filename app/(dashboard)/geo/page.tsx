import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { BrazilMap } from "@/components/dashboard/brazil-map";
import { getDashboardDateRange } from "@/lib/dashboard/date-range";

type RegionRow = { region: string; visitor_count: number | string };
type CountryRow = { country: string; visitor_count: number | string };
type CityRow = { city: string; region: string | null; visitor_count: number | string };

export default async function GeoPage() {
  const supabase = await createClient();
  const range = await getDashboardDateRange();
  const [regionRes, countryRes, cityRes] = await Promise.all([
    supabase.rpc("visitors_by_region", { date_from: range.from, date_to: range.to }),
    supabase.rpc("visitors_by_country", { date_from: range.from, date_to: range.to }),
    supabase.rpc("visitors_by_city", { date_from: range.from, date_to: range.to }),
  ]);

  const regions = (regionRes.data ?? []) as RegionRow[];
  const countries = (countryRes.data ?? []) as CountryRow[];
  const cities = (cityRes.data ?? []) as CityRow[];

  const sortedRegions = [...regions].sort((a, b) => Number(b.visitor_count) - Number(a.visitor_count));
  const sortedCountries = [...countries].sort((a, b) => Number(b.visitor_count) - Number(a.visitor_count));
  const sortedCities = [...cities].sort((a, b) => Number(b.visitor_count) - Number(a.visitor_count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Geo</h1>
        <p className="text-sm text-muted-foreground">
          {range.label} — distribuição de visitantes por país, estado e cidade, a partir do geo do IP.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Mapa (Brasil)</h2>
          {regions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Sem dados de geo ainda — só é populado em produção/preview na Vercel, não em `next dev` local.
            </p>
          ) : (
            <BrazilMap data={regions} />
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Países</h2>
          {sortedCountries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sortedCountries.slice(0, 10).map((c) => (
                <li key={c.country} className="flex items-center justify-between">
                  <span>{c.country}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{c.visitor_count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Estados</h2>
          {sortedRegions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sortedRegions.slice(0, 10).map((r) => (
                <li key={r.region} className="flex items-center justify-between">
                  <span>{r.region}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{r.visitor_count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-semibold">Cidades</h2>
          {sortedCities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sortedCities.slice(0, 10).map((c) => (
                <li key={`${c.city}-${c.region}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {c.city}
                    {c.region && <span className="text-muted-foreground"> · {c.region}</span>}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {c.visitor_count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
