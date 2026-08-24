"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JsonViewer } from "./json-viewer";
import { formatDateTime } from "@/lib/format";

export type EventDetailData = {
  event_name: string;
  event_id: string;
  created_at: string;
  payload_meta: unknown;
  response_meta: unknown;
  payload_ga4: unknown;
  response_ga4: unknown;
};

export function EventDetailDialog({ event, trigger }: { event: EventDetailData; trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{event.event_name}</DialogTitle>
          <DialogDescription className="font-mono">
            {event.event_id} · {formatDateTime(event.created_at)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <JsonViewer label="Payload Meta" data={event.payload_meta} />
          <JsonViewer label="Response Meta" data={event.response_meta} />
          <JsonViewer label="Payload GA4" data={event.payload_ga4} />
          <JsonViewer label="Response GA4" data={event.response_ga4} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
