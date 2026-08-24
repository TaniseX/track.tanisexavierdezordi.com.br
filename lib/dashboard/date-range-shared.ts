// Constantes compartilhadas entre o server (lib/dashboard/date-range.ts,
// "server-only") e o client component do filtro — um módulo "server-only"
// não pode ser importado no client, então isso mora à parte.
export const DATE_RANGE_COOKIE = "trck_range";

export type DateRangeKey = "today" | "7d" | "30d" | "90d" | "custom";

// Só as opções fixas — "custom" tem UI própria (pill separado, não um botão
// do segmentado), ver components/layout/date-range-filter.tsx.
export const FIXED_DATE_RANGE_OPTIONS: { key: Exclude<DateRangeKey, "custom">; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
];
