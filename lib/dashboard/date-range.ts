import "server-only";
import { cookies } from "next/headers";
import { DATE_RANGE_COOKIE, type DateRangeKey } from "./date-range-shared";

export type DashboardDateRange = {
  key: DateRangeKey;
  label: string;
  /** ISO, início do período (inclusive), fuso America/Sao_Paulo. */
  from: string;
  /** ISO, fim do período (inclusive), fuso America/Sao_Paulo. */
  to: string;
  /** YYYY-MM-DD (fuso SP) — pro time_range da API de Insights da Meta. */
  fromDate: string;
  toDate: string;
};

// São Paulo não observa horário de verão desde 2019 — offset fixo -03:00,
// não precisa de lib de timezone pra calcular início/fim do dia.
function spDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

function spStartOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00-03:00`);
}

function spEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999-03:00`);
}

function addDays(dateStr: string, days: number): string {
  const d = spStartOfDay(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return spDateStr(d);
}

export async function getDashboardDateRange(): Promise<DashboardDateRange> {
  const store = await cookies();
  const raw = store.get(DATE_RANGE_COOKIE)?.value;
  const today = spDateStr(new Date());

  if (raw?.startsWith("custom:")) {
    const [, from, to] = raw.split(":");
    if (from && to) {
      return {
        key: "custom",
        label: `${from} a ${to}`,
        from: spStartOfDay(from).toISOString(),
        to: spEndOfDay(to).toISOString(),
        fromDate: from,
        toDate: to,
      };
    }
  }

  const lastNDays: Record<string, { key: DateRangeKey; label: string; days: number }> = {
    "7d": { key: "7d", label: "Últimos 7 dias", days: 7 },
    "30d": { key: "30d", label: "Últimos 30 dias", days: 30 },
    "90d": { key: "90d", label: "Últimos 90 dias", days: 90 },
  };

  if (raw && lastNDays[raw]) {
    const { key, label, days } = lastNDays[raw];
    const fromDate = addDays(today, -(days - 1));
    return {
      key,
      label,
      from: spStartOfDay(fromDate).toISOString(),
      to: spEndOfDay(today).toISOString(),
      fromDate,
      toDate: today,
    };
  }

  return {
    key: "today",
    label: "Hoje",
    from: spStartOfDay(today).toISOString(),
    to: spEndOfDay(today).toISOString(),
    fromDate: today,
    toDate: today,
  };
}
