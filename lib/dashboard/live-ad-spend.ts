import "server-only";
import { createClient } from "@/lib/supabase/server";
import { readSecret } from "@/lib/vault/secrets";
import { fetchAdInsights, fetchDailySpend } from "@/lib/meta/ads-insights";

/**
 * Soma o gasto de todas as contas de anúncio ativas pro período exato do
 * filtro de data global — busca ao vivo na Meta (decisão registrada no
 * plano: sem cache histórico diário, mantém a filosofia de "nunca sincroniza
 * sozinho na navegação" só que aqui é leitura, não grava nada). Falha de uma
 * conta não derruba as outras nem a página.
 */
export async function getLiveAdSpend(fromDate: string, toDate: string): Promise<number> {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("meta_ad_accounts")
    .select("ad_account_id, access_token_id")
    .eq("is_active", true);

  if (!accounts || accounts.length === 0) return 0;

  const sums = await Promise.all(
    accounts.map(async (account) => {
      try {
        const token = await readSecret(account.access_token_id);
        const rows = await fetchAdInsights(account.ad_account_id, token, fromDate, toDate);
        return rows.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
      } catch {
        return 0;
      }
    }),
  );

  return sums.reduce((sum, value) => sum + value, 0);
}

/**
 * Gasto por dia somado entre todas as contas ativas, pro gráfico "Receita e
 * investimento por dia" — mesmo padrão do getLiveAdSpend (ao vivo, paralelo
 * por conta, falha isolada não derruba o resto).
 */
export async function getDailyAdSpend(fromDate: string, toDate: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("meta_ad_accounts")
    .select("ad_account_id, access_token_id")
    .eq("is_active", true);

  const totals = new Map<string, number>();
  if (!accounts || accounts.length === 0) return totals;

  const perAccount = await Promise.all(
    accounts.map(async (account) => {
      try {
        const token = await readSecret(account.access_token_id);
        return await fetchDailySpend(account.ad_account_id, token, fromDate, toDate);
      } catch {
        return [];
      }
    }),
  );

  for (const rows of perAccount) {
    for (const row of rows) {
      totals.set(row.date, (totals.get(row.date) ?? 0) + row.spend);
    }
  }

  return totals;
}
