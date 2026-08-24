"use client";

import { useState, type ReactNode } from "react";
import { User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EventDetailDialog } from "./event-detail-dialog";
import { eventColorClass } from "@/lib/dashboard/event-colors";
import { formatDateTime } from "@/lib/format";
import { getVisitorDetail, type VisitorDetail } from "@/app/(dashboard)/eventos/actions";

function ProfileField({ label, value }: { label: string; value: ReactNode }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono">{value}</dd>
    </>
  );
}

export function VisitorDrawer({ trckUserId, trigger }: { trckUserId: string; trigger: ReactNode }) {
  const [detail, setDetail] = useState<VisitorDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpenChange(open: boolean) {
    if (!open || detail) return;
    setLoading(true);
    try {
      const data = await getVisitorDetail(trckUserId);
      setDetail(data);
    } finally {
      setLoading(false);
    }
  }

  const visitor = detail?.visitor;

  return (
    <Sheet onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">{visitor?.name ?? visitor?.email ?? "Visitante"}</SheetTitle>
              <SheetDescription className="truncate font-mono text-xs">{trckUserId}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {detail && (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Dados do visitante</h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <ProfileField label="Nome" value={visitor?.name} />
                <ProfileField label="Email" value={visitor?.email} />
                <ProfileField label="Telefone" value={visitor?.phone} />
                <ProfileField label="UTM source" value={visitor?.utm_source} />
                <ProfileField label="UTM medium" value={visitor?.utm_medium} />
                <ProfileField label="UTM campaign" value={visitor?.utm_campaign} />
                <ProfileField label="UTM term" value={visitor?.utm_term} />
                <ProfileField label="UTM content" value={visitor?.utm_content} />
                <ProfileField label="Landing page" value={visitor?.landing_url} />
                <ProfileField label="Referrer" value={visitor?.referrer} />
                <ProfileField
                  label="Geo"
                  value={[visitor?.geo_city, visitor?.geo_region, visitor?.geo_country].filter(Boolean).join(", ")}
                />
                <ProfileField label="IP" value={visitor?.ip} />
                <ProfileField label="fbp" value={visitor?.fbp} />
                <ProfileField label="fbc" value={visitor?.fbc} />
                <ProfileField label="GA client_id" value={visitor?.ga_client_id} />
                <ProfileField label="User agent" value={visitor?.user_agent} />
                <ProfileField
                  label="1ª visita"
                  value={visitor?.first_seen_at ? formatDateTime(visitor.first_seen_at) : null}
                />
                <ProfileField
                  label="Última visita"
                  value={visitor?.last_seen_at ? formatDateTime(visitor.last_seen_at) : null}
                />
              </dl>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Histórico de eventos ({detail.events.length})</h3>
              {detail.events.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.events.map((event) => (
                    <li key={event.id}>
                      <EventDetailDialog
                        event={event}
                        trigger={
                          <button
                            type="button"
                            className="w-full rounded-md border border-border p-2 text-left text-xs transition-colors hover:bg-accent/50"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`rounded-full border px-2 py-0.5 ${eventColorClass(event.event_name)}`}>
                                {event.event_name}
                              </span>
                              <span className="text-muted-foreground">{formatDateTime(event.created_at)}</span>
                            </div>
                            <p className="mt-1 truncate text-muted-foreground">
                              {[event.utm_source, event.utm_medium, event.utm_campaign].filter(Boolean).join(" · ") ||
                                "sem utm"}
                            </p>
                          </button>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
