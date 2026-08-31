import Link from "next/link";
import { User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { EventStatusBadge } from "@/components/dashboard/event-status-badge";
import { VisitorDrawer } from "@/components/dashboard/visitor-drawer";
import { formatDateTime } from "@/lib/format";
import { eventColorClass } from "@/lib/dashboard/event-colors";
import { resolveCampaignNames } from "@/lib/dashboard/resolve-campaign-names";
import { originFromReferrer } from "@/lib/dashboard/origin-label";
import { getDashboardDateRange } from "@/lib/dashboard/date-range";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["sent", "partial", "error", "skipped", "pending"];

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ event_name?: string; status?: string; before?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const range = await getDashboardDateRange();

  let query = supabase
    .from("events_log")
    .select(
      "id, event_id, event_name, status, value, currency, created_at, trck_user_id, utm_source, utm_campaign, utm_content, geo_country, geo_region, geo_city, payload_meta, response_meta, payload_ga4, response_ga4, visitor:visitor_id(referrer)",
    )
    .gte("created_at", range.from)
    .lte("created_at", range.to)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (params.event_name) query = query.eq("event_name", params.event_name);
  if (params.status) query = query.eq("status", params.status);
  if (params.before) query = query.lt("created_at", params.before);

  const [{ data }, { data: eventNamesData }] = await Promise.all([
    query,
    supabase.rpc("count_events_by_name", { date_from: range.from, date_to: range.to }),
  ]);

  const rows = data ?? [];
  const hasNextPage = rows.length > PAGE_SIZE;
  const pageRows = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasNextPage ? pageRows[pageRows.length - 1].created_at : null;
  const eventNames = ((eventNamesData ?? []) as { event_name: string }[]).map((e) => e.event_name);

  const names = await resolveCampaignNames(
    pageRows.map((r) => r.utm_campaign),
    pageRows.map((r) => r.utm_content),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
        <p className="text-sm text-muted-foreground">
          {range.label} — clique num evento pra ver o visitante e o histórico completo.
        </p>
      </div>

      <form className="flex flex-wrap gap-3" action="/eventos" method="get">
        <select
          name="event_name"
          defaultValue={params.event_name ?? ""}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos os eventos</option>
          {eventNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
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
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Geo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((row) => {
                const campaignName = names.campaignName(row.utm_campaign);
                const adsetName = names.adsetName(row.utm_content);
                const adName = names.adName(row.utm_content);
                const geo = [row.geo_city, row.geo_region, row.geo_country].filter(Boolean).join(", ");

                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${eventColorClass(row.event_name)}`}
                      >
                        {row.event_name}
                      </span>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{row.event_id}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-xs">
                      {campaignName || adsetName || adName ? (
                        <div className="space-y-0.5">
                          {campaignName && <p className="truncate">{campaignName}</p>}
                          {adsetName && <p className="truncate text-muted-foreground">{adsetName}</p>}
                          {adName && <p className="truncate text-muted-foreground">{adName}</p>}
                        </div>
                      ) : row.utm_campaign || row.utm_content ? (
                        <span className="text-muted-foreground">
                          {`${row.utm_campaign ?? ""} ${row.utm_content ?? ""}`.trim()}
                        </span>
                      ) : row.utm_source ? (
                        <span className="text-muted-foreground">{row.utm_source}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {originFromReferrer(
                            (row.visitor as unknown as { referrer: string | null } | null)?.referrer,
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{geo || "—"}</td>
                    <td className="px-4 py-3">
                      <EventStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {row.event_name === "Purchase" && row.value ? `${row.currency ?? ""} ${row.value}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {row.trck_user_id ? (
                        <VisitorDrawer
                          trckUserId={row.trck_user_id}
                          trigger={
                            <Button variant="outline" size="icon" aria-label="Ver visitante">
                              <User className="h-4 w-4" />
                            </Button>
                          }
                        />
                      ) : (
                        <Button variant="outline" size="icon" disabled aria-label="Sem visitante identificado">
                          <User className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum evento encontrado.
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
            href={`/eventos?${new URLSearchParams({
              ...(params.event_name ? { event_name: params.event_name } : {}),
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
