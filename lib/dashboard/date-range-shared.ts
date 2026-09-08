// Constantes compartilhadas entre o server (lib/dashboard/date-range.ts,
// "server-only") e o client component do filtro — um módulo "server-only"
// não pode ser importado no client, então isso mora à parte.
export const DATE_RANGE_COOKIE = "trck_range";

export type DateRangeKey =
  | "today"
  | "yesterday"
  | "yesterday_today"
  | "7d"
  | "30d"
  | "90d"
  | "custom";

// Só as opções fixas — "custom" tem UI própria (pill separado, não um botão
// do segmentado), ver components/layout/date-range-filter.tsx. shortLabel é
// o texto usado em telas de celular (o filtro divide a topbar com
// atualizar/tema/sair — "7 dias"/"30 dias"/"90 dias" por extenso não cabe).
export const FIXED_DATE_RANGE_OPTIONS: {
  key: Exclude<DateRangeKey, "custom">;
  label: string;
  shortLabel: string;
}[] = [
  { key: "today", label: "Hoje", shortLabel: "Hoje" },
  { key: "yesterday", label: "Ontem", shortLabel: "Ontem" },
  { key: "yesterday_today", label: "Ontem e hoje", shortLabel: "Ont+hoje" },
  { key: "7d", label: "7 dias", shortLabel: "7d" },
  { key: "30d", label: "30 dias", shortLabel: "30d" },
  { key: "90d", label: "90 dias", shortLabel: "90d" },
];
