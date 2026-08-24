import { Users, CreditCard, ShoppingCart, Wallet, DollarSign, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { FunnelSteps } from "@/components/dashboard/funnel-steps";
import { BrazilMap } from "@/components/dashboard/brazil-map";
import { RevenueChart, type RevenueChartPoint } from "@/components/dashboard/revenue-chart";
import { getDashboardDateRange } from "@/lib/dashboard/date-range";
import { getLiveAdSpend, getDailyAdSpend } from "@/lib/dashboard/live-ad-spend";
import { formatCurrency } from "@/lib/format";

function enumerateDays(fromDate: string, toDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const range = await getDashboardDateRange();

  const [
    visitorsRes,
    funnelRes,
    purchasesRes,
    billingRes,
    spend,
    dailySpend,
    dailyRevenueRes,
    regionRes,
    countryRes,
    cityRes,
  ] = await Promise.all([
    supabase
      .from("visitors")
      .select("*", { count: "exact", head: true })
      .gte("created_at", range.from)
      .lte("created_at", range.to),
    supabase.rpc("funnel_counts", { date_from: range.from, date_to: range.to }),
    supabase
      .from("purchases")
      .select("*", { count: "exact", head: true })
      .in("status", ["approved", "confirmed"])
      .gte("created_at", range.from)
      .lte("created_at", range.to),
    supabase.rpc("billing_summary", { date_from: range.from, date_to: range.to }).single(),
    getLiveAdSpend(range.fromDate, range.toDate),
    getDailyAdSpend(range.fromDate, range.toDate),
    supabase.rpc("revenue_by_day", { date_from: range.from, date_to: range.to }),
    supabase.rpc("visitors_by_region", { date_from: range.from, date_to: range.to }),
    supabase.rpc("visitors_by_country", { date_from: range.from, date_to: range.to }),
    supabase.rpc("visitors_by_city", { date_from: range.from, date_to: range.to }),
  ]);

  const visitors = visitorsRes.count ?? 0;
  const purchases = purchasesRes.count ?? 0;
  const funnel = (funnelRes.data ?? []) as { stage: string; visitor_count: number }[];
  const checkoutCount = Number(funnel.find((f) => f.stage === "checkout")?.visitor_count ?? 0);
  const revenue = Number((billingRes.data as { total_revenue?: number } | null)?.total_revenue ?? 0);
  const roas = spend > 0 ? revenue / spend : null;

  const costFor = (count: number) => (count > 0 ? `custo ${formatCurrency(spend / count)}` : undefined);

  const dailyRevenue = new Map(
    ((dailyRevenueRes.data ?? []) as { day: string; revenue: number | string }[]).map((r) => [
      r.day,
      Number(r.revenue),
    ]),
  );
  const chartData: RevenueChartPoint[] = enumerateDays(range.fromDate, range.toDate).map((date) => ({
    date,
    revenue: dailyRevenue.get(date) ?? 0,
    spend: dailySpend.get(date) ?? 0,
  }));

  const regions = (regionRes.data ?? []) as { region: string; visitor_count: number | string }[];
  const countries = (countryRes.data ?? []) as { country: string; visitor_count: number | string }[];
  const cities = (cityRes.data ?? []) as { city: string; region: string | null; visitor_count: number | string }[];
  const sortedCountries = [...countries].sort((a, b) => Number(b.visitor_count) - Number(a.visitor_count));
  const sortedRegions = [...regions].sort((a, b) => Number(b.visitor_count) - Number(a.visitor_count));
  const sortedCities = [...cities].sort((a, b) => Number(b.visitor_count) - Number(a.visitor_count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">{range.label} — resumo do tracking no período.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Visitantes únicos" value={String(visitors)} hint={costFor(visitors)} icon={Users} />
        <MetricCard label="Checkouts" value={String(checkoutCount)} hint={costFor(checkoutCount)} icon={CreditCard} />
        <MetricCard label="Compras" value={String(purchases)} hint={costFor(purchases)} icon={ShoppingCart} />
        <MetricCard label="Investido" value={formatCurrency(spend)} icon={Wallet} />
        <MetricCard label="Receita" value={formatCurrency(revenue)} icon={DollarSign} />
        <MetricCard label="ROAS" value={roas !== null ? `${roas.toFixed(2)}x` : "—"} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <h2 className="font-semibold">Receita e investimento por dia</h2>
          <p className="mb-4 text-sm text-muted-foreground">Receita (compras aprovadas) vs. investido no Meta.</p>
          <RevenueChart data={chartData} />
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold">Funil</h2>
          <p className="mb-4 text-sm text-muted-foreground">Visitou → Lead → Checkout → Compra.</p>
          <FunnelSteps steps={funnel} />
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <h3 className="mb-1 font-semibold">Mapa (Brasil)</h3>
          <p className="mb-3 text-xs text-muted-foreground">Visitantes por estado.</p>
          {regions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Sem dados de geo nesse período.</p>
          ) : (
            <BrazilMap data={regions} />
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 font-semibold">Países</h3>
          {sortedCountries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sortedCountries.slice(0, 8).map((c) => (
                <li key={c.country} className="flex items-center justify-between">
                  <span>{c.country}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{c.visitor_count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 font-semibold">Estados</h3>
          {sortedRegions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sortedRegions.slice(0, 8).map((r) => (
                <li key={r.region} className="flex items-center justify-between">
                  <span>{r.region}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{r.visitor_count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 font-semibold">Cidades</h3>
          {sortedCities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sortedCities.slice(0, 8).map((c) => (
                <li key={`${c.city}-${c.region}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {c.city}
                    {c.region && <span className="text-muted-foreground"> · {c.region}</span>}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{c.visitor_count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
