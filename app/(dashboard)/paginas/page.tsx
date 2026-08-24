import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { getDashboardDateRange } from "@/lib/dashboard/date-range";

type PageRow = {
  page_url: string;
  pageviews: number | string;
  unique_visitors: number | string;
  leads: number | string;
  checkouts: number | string;
  purchases: number | string;
};

export default async function PaginasPage() {
  const supabase = await createClient();
  const range = await getDashboardDateRange();

  const { data } = await supabase.rpc("page_funnel", { date_from: range.from, date_to: range.to });
  const rows = ((data ?? []) as PageRow[]).sort(
    (a, b) => Number(b.pageviews) - Number(a.pageviews),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Páginas</h1>
        <p className="text-sm text-muted-foreground">
          {range.label} — taxa de conversão por URL de LP (visualização → lead → checkout → compra).
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Página</th>
                <th className="px-4 py-3 font-medium text-right">Visualizações</th>
                <th className="px-4 py-3 font-medium text-right">Usuários únicos</th>
                <th className="px-4 py-3 font-medium text-right">Leads</th>
                <th className="px-4 py-3 font-medium text-right">Iniciou checkout</th>
                <th className="px-4 py-3 font-medium text-right">Compras</th>
                <th className="px-4 py-3 font-medium text-right">Conversão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const pageviews = Number(row.pageviews);
                const purchases = Number(row.purchases);
                const conversion = pageviews > 0 ? (purchases / pageviews) * 100 : 0;
                return (
                  <tr key={row.page_url}>
                    <td className="max-w-[320px] truncate px-4 py-3 font-mono text-xs" title={row.page_url}>
                      {row.page_url}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{pageviews}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{Number(row.unique_visitors)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{Number(row.leads)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{Number(row.checkouts)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{purchases}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{conversion.toFixed(2)}%</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma página com dados nesse período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
