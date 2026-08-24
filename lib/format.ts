export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatDateTime(value: string): string {
  // timeZone explícito: o server (Vercel) roda em UTC, sem isso o horário
  // exibido saía 3h adiantado em vez do horário de São Paulo.
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
