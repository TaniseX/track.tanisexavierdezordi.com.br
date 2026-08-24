import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/metric-card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getDashboardDateRange } from "@/lib/dashboard/date-range";

const PAGE_SIZE = 25;

type BillingSummary = {
  total_revenue: number;
  avg_ticket: number;
  refund_count: number;
  total_count: number;
};

export default async function FaturamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; before?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const range = await getDashboardDateRange();

  let purchasesQuery = supabase
    .from("purchases")
    .select(
      "id, product_name, status, gross_value, currency, match_method, created_at, utm_source, utm_medium, utm_campaign, utm_term, utm_content",
    )
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (params.status) purchasesQuery = purchasesQuery.eq("status", params.status);
  if (params.before) purchasesQuery = purchasesQuery.lt("created_at", params.before);

  const [summaryRes, purchasesRes] = await Promise.all([
    supabase.rpc("billing_summary", { date_from: range.from, date_to: range.to }).single(),
    purchasesQuery,
  ]);

  const summary = (summaryRes.data ?? {
    total_revenue: 0,
    avg_ticket: 0,
    refund_count: 0,
    total_count: 0,
  }) as BillingSummary;

  const rows = purchasesRes.data ?? [];
  const hasNextPage = rows.length > PAGE_SIZE;
  const pageRows = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasNextPage ? pageRows[pageRows.length - 1].created_at : null;
  const refundRate =
    Number(summary.total_count) > 0 ? (Number(summary.refund_count) / Number(summary.total_count)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Faturamento</h1>
        <p className="text-sm text-muted-foreground">
          {range.label} — receita, ticket médio, reembolsos e a tabela de compras com origem.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Receita total" value={formatCurrency(Number(summary.total_revenue))} />
        <MetricCard label="Ticket médio" value={formatCurrency(Number(summary.avg_ticket))} />
        <MetricCard label="Taxa de reembolso" value={`${refundRate.toFixed(1)}%`} />
      </div>

      <form className="flex flex-wrap gap-3" action="/faturamento" method="get">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="approved">approved</option>
          <option value="confirmed">confirmed</option>
          <option value="pending">pending</option>
          <option value="refunded">refunded</option>
          <option value="chargeback">chargeback</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Match</th>
                <th className="px-4 py-3 font-medium">Origem (UTMs)</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">{row.product_name ?? "—"}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {row.gross_value != null ? formatCurrency(Number(row.gross_value), row.currency ?? "BRL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.match_method}</td>
                  <td className="max-w-[260px] px-4 py-3 text-xs text-muted-foreground">
                    {row.utm_source || row.utm_medium || row.utm_campaign || row.utm_term || row.utm_content ? (
                      <div className="space-y-0.5">
                        {row.utm_source && <p className="truncate">source: {row.utm_source}</p>}
                        {row.utm_medium && <p className="truncate">medium: {row.utm_medium}</p>}
                        {row.utm_campaign && <p className="truncate">campaign: {row.utm_campaign}</p>}
                        {row.utm_content && <p className="truncate">content: {row.utm_content}</p>}
                        {row.utm_term && <p className="truncate">term: {row.utm_term}</p>}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma compra encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {hasNextPage && nextCursor && (
        <div className="flex justify-end">
          <Link
            href={`/faturamento?${new URLSearchParams({
              ...(params.status ? { status: params.status } : {}),
              before: nextCursor,
            }).toString()}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Próxima página
          </Link>
        </div>
      )}
    </div>
  );
}
