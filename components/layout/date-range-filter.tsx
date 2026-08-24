"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DATE_RANGE_COOKIE,
  FIXED_DATE_RANGE_OPTIONS,
  type DateRangeKey,
} from "@/lib/dashboard/date-range-shared";

const COOKIE_DAYS = 365;
const CHANGE_EVENT = "trck-range-change";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(value: string) {
  const expires = new Date(Date.now() + COOKIE_DAYS * 86400000).toUTCString();
  document.cookie = `${DATE_RANGE_COOKIE}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Leitura do cookie é client-only (document indisponível no SSR) — mesmo
// padrão já usado no projeto pra evitar setState em efeito / mismatch de
// hidratação: getServerSnapshot devolve um valor fixo, getSnapshot só lê o
// cookie de verdade depois de hidratado, e o evento custom re-sincroniza
// quando o próprio componente escreve um valor novo.
function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

function getSnapshot(): string {
  return readCookie(DATE_RANGE_COOKIE) ?? "today";
}

function getServerSnapshot(): string {
  return "today";
}

export function DateRangeFilter() {
  const router = useRouter();
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  function apply(value: string) {
    writeCookie(value);
    router.refresh();
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    apply(`custom:${customFrom}:${customTo}`);
    setShowCustom(false);
  }

  const isCustom = current.startsWith("custom:");
  const activeFixed: DateRangeKey | null = isCustom
    ? null
    : (FIXED_DATE_RANGE_OPTIONS.find((o) => o.key === current)?.key ?? "today");

  const customLabel = isCustom ? current.slice("custom:".length).replace(":", " a ") : "Personalizado";

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1 text-xs">
        <Calendar className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        {FIXED_DATE_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => {
              setShowCustom(false);
              apply(opt.key);
            }}
            className={cn(
              "rounded px-2 py-1 transition-colors",
              activeFixed === opt.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowCustom((prev) => !prev)}
        className={cn(
          "whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
          isCustom
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {customLabel}
      </button>

      {showCustom && (
        <div className="absolute right-0 top-full z-50 mt-2 flex flex-col gap-2 rounded-md border border-border bg-card p-3 shadow-xl">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            De
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Até
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
