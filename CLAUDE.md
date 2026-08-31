# track.tanisexavierdezordi.com.br

Sistema de tracking server-side (Meta Conversions API + GA4 Measurement Protocol,
deduplicados com o client-side via `event_id`) com painel administrativo. Integra
com o checkout **Guru** (Digital Manager Guru) via webhook. Cliente: Tanise
Xavier de Zordi — fluxo de captação principal em
`movimentosemdor.tanisexavierdezordi.com.br`.

Código herdado 1:1 (mesmo schema, mesma stack) do sistema construído antes
pra `track.advflowpro.com` — o plano de fases original
(`C:\Users\Note_DELL\.claude\plans\voc-meu-parceiro-mossy-phoenix.md`) é
daquele projeto, não deste; as seções abaixo (Fases 1-7 + pós-deploy)
descrevem como cada peça do código atual foi construída e testada lá,
mantidas aqui como documentação técnica ainda válida. Ver ## Estado atual
no fim deste arquivo pro que já foi adaptado pra esta cliente e o que ainda
falta.

## Stack

- **Next.js 16** (App Router, Turbopack, Node ≥20), **React 19**, **TypeScript**.
- **Tailwind v4** (CSS-first, `@theme inline` em `app/globals.css`).
- **Supabase** (Postgres + Auth), acessado via `@supabase/ssr`.
- Deploy: Vercel. Repo: GitHub.

## Convenções importantes

### Next.js 16: `proxy.ts`, não `middleware.ts`
A partir do Next 16, o antigo `middleware.ts` chama-se **`proxy.ts`** (mesma API,
export `proxy` em vez de `middleware`). O arquivo na raiz é só o entrypoint —
a lógica fica em `lib/supabase/proxy.ts` (`updateSession`). Rotas protegidas por
sessão são adicionadas na Fase 1.

### Versões de API externas em constante única
Toda API com versão na URL usa uma constante exportada, fácil de atualizar:
- Meta Graph API / Conversions API: `META_GRAPH_API_VERSION` em `lib/meta/constants.ts`
  (atual: `v25.0`).

Antes de subir a versão, conferir a doc oficial e o changelog de deprecação.

### Chaves do Supabase: novas com fallback para legadas
Supabase migrou para `sb_publishable_xxx` / `sb_secret_xxx`. Usamos as novas com
fallback (`lib/supabase/env.ts`):
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → fallback `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY` → fallback `SUPABASE_SERVICE_ROLE_KEY`

`lib/supabase/admin.ts` (secret key, ignora RLS) é **server-only** — nunca importar
em Client Components nem em módulo compartilhado com o client.

### Segredos no Supabase Vault (não em env, não em pgcrypto manual)
Credenciais de Meta/GA4/Guru são cadastradas **pelo painel**, não em env vars.
Ficam armazenadas no **Supabase Vault** (`supabase/migrations/0004_secrets_vault.sql`),
não em colunas `bytea` cifradas manualmente — tentamos pgcrypto com uma chave
custom (`alter database ... set app.encryption_key = ...`) primeiro, mas o
Postgres gerenciado do Supabase nega isso (`permission denied to set parameter`,
já que `ALTER DATABASE/ROLE SET` de parâmetro customizado exige superusuário,
indisponível lá). Vault resolve isso nativamente.

Tabelas de config guardam só o `uuid` do segredo (`webhook_token_id`,
`api_secret_id`, `capi_token_id`, `access_token_id`), sempre `references
vault.secrets (id)`. Uso, sempre a partir do servidor
(`lib/supabase/admin.ts`, secret role):
```sql
select vault.create_secret('valor', 'label opcional'); -- retorna uuid, salvar na coluna
select vault.update_secret('<uuid>', 'novo valor');
select decrypted_secret from vault.decrypted_secrets where id = '<uuid>';
```
`anon`/`authenticated` não têm acesso ao schema `vault` (revogado explicitamente
na migration).

### Contrato do `trck_user_id`
- Gerado por `/api/identify` (visitante novo) e persistido em `visitors.trck_user_id`.
- Viaja para o checkout Guru via **`utm_term`** na URL do link de checkout
  (decisão registrada no plano — confirmada com venda de teste na Fase 4).
- Viaja em links de WhatsApp (mecanismo de montagem do link é responsabilidade do
  site/CRM externo, fora deste repo — este repo só gera e expõe o id).
- No webhook de compra, o matching é em cascata: `utm_term` → email → telefone →
  `unmatched` (dispara Purchase mesmo sem match, com o que a Guru forneceu).

### `events_log`: payload/response são arrays
Um evento é disparado para **todos os destinos ativos** (todos os pixels Meta +
todas as propriedades GA4). Por isso `payload_meta`, `response_meta`, `payload_ga4`,
`response_ga4` são **arrays jsonb** (um item por destino), não um objeto único.

### Geolocalização sem API externa
Usar `geolocation()` de `@vercel/functions` dentro de Route Handlers. A Vercel
injeta os headers `x-vercel-ip-*` automaticamente em prod/preview. Não funciona em
`next dev` local — o código deve degradar para `geo: null` graciosamente.

### Rate limiting: Postgres, sem dependência externa
`/api/identify` e `/api/event` (endpoints públicos) usam rate limiting baseado em
tabela Postgres (decisão do usuário — sem Upstash/Redis).

## RLS

Todas as tabelas: `select` liberado só para `authenticated` (painel), qualquer
escrita só para `service_role` (via `lib/supabase/admin.ts`, nunca do client).
Cadastro público de usuários fica desligado nas configurações de Auth do projeto
Supabase (Dashboard → Authentication → Providers).

## Migrations

SQL em `supabase/migrations/`, aplicadas colando manualmente no SQL editor do
Supabase Dashboard, nessa ordem: `0001_extensions` → `0002_core_tables` →
`0003_config_tables` → `0004_secrets_vault` → `0005_rls_policies`.

Depois de aplicar, gerar os tipos TypeScript do schema:
```
supabase gen types typescript --project-id <id> > lib/types/database.ts
```
(ainda não gerado — os clientes Supabase em `lib/supabase/*.ts` não estão
parametrizados com `Database` até isso rodar pela primeira vez.)

## Criar o primeiro usuário admin

Não há signup público. Criar manualmente pelo Dashboard do Supabase
(Authentication → Users → Add user), ou via `supabase.auth.admin.createUser()`
com o client de `lib/supabase/admin.ts` (secret key), depois logar em `/login`.

## Autenticação e shell do painel (Fase 1)

- `proxy.ts` faz o check otimista (redireciona `/login` ↔ `/` conforme sessão);
  `app/(dashboard)/layout.tsx` repete o check "seguro" (`getUser()`, contata o
  Auth server), como recomendado na doc de auth do Next.js.
- `lib/auth/actions.ts`: server actions `signIn`/`signOut`, usadas por
  `app/(auth)/login/page.tsx` (via `useActionState`) e `LogoutButton`.
- Sidebar (desktop, fixa) e drawer mobile compartilham a lista de navegação em
  `components/layout/nav-items.ts` + `nav-links.tsx`.
- **Gotcha de CSS**: o drawer mobile (`components/layout/mobile-nav.tsx`) é
  renderizado via `createPortal` pro `document.body`. Sem isso, como a
  `Topbar` usa `backdrop-blur`, ela vira *containing block* dos elementos
  `fixed` dentro dela (regra do CSS pra filter/backdrop-filter/transform), e o
  drawer ficava preso à altura da Topbar (~64px) em vez da tela inteira. Se
  precisar de outro overlay/modal fixed dentro de um elemento com
  blur/transform, mesma solução: portal pro body.
- Primitives de UI em `components/ui/` (Button, Input, Label, Card) — estilo
  shadcn, sem Radix ainda (só entra quando algo realmente precisar, ex.: Dialog
  do modal de evento na Fase 5).

## Configuração de credenciais (Fase 2)

- `supabase/migrations/0006_vault_helpers.sql` cria `create_secret`/`update_secret`/
  `read_secret` no schema `public` — o PostgREST (e portanto `.rpc()` do
  supabase-js) só expõe funções de `public` por padrão, então essas functions
  fazem a ponte pro schema `vault`. `lib/vault/secrets.ts` é o wrapper
  TypeScript por cima delas (`createSecret`/`updateSecret`/`readSecret`/`maskSecret`).
- Padrão de rota por entidade de config (`ga4`, `meta-pixels`, `meta-ad-accounts`):
  `/novo` (criar), `/[id]` (editar + testar conexão + remover), lista na raiz.
  Sem modal/Dialog — formulário em página própria (mais simples, melhor em
  mobile). `components/config/account-form.tsx` e `account-list.tsx` são
  genéricos, reusados pelas 3 entidades (mesmo formato: label + identificador
  + segredo + ativo).
- Editar uma conta: campo de segredo fica em branco (`secretIsSet` no
  `AccountForm`) — só troca o valor no Vault se o usuário digitar algo.
- Testar conexão: GA4 usa o endpoint de debug do Measurement Protocol
  (`lib/ga4/test-connection.ts`); Meta pixel dispara um evento de teste real
  via CAPI (`lib/meta/test-connection.ts`, usa `meta_test_event_code` de
  `settings` se configurado); Ad Account faz um GET simples no Graph API
  (`lib/meta/ad-accounts.ts`). Todos gravam `last_test_status`/`last_test_message`.
- `lib/meta/capi.ts` (`sendMetaEvents`) é a função de baixo nível de envio pra
  Graph API — criada aqui pro teste de conexão, reusada no disparo real de
  eventos nas Fases 3/4.
- Webhook da Guru: `settings.webhook_token_id` (Vault) é o único segredo
  **mostrado em claro** na UI (os outros — api_secret/capi_token/access_token —
  nunca voltam pro client depois de salvos). Justificativa: o usuário precisa
  copiar essa URL pra colar no cadastro de webhook da Guru; os demais são só
  usados servidor-a-servidor.

## Captura client-side + disparo server-side (Fase 3)

- **`public/tracker.js`**: script vanilla (sem build step) que o site principal
  carrega via `<script src="https://track.tanisexavierdezordi.com.br/tracker.js" async>`.
  Resolve o `API_BASE` a partir do próprio `document.currentScript.src`, então
  funciona em qualquer domínio sem hardcode.
- **`trck_user_id` NÃO viaja por cookie da nossa API** — como `/api/identify`
  é cross-origin (chamado de `tanisexavierdezordi.com.br`, servido por
  `track.tanisexavierdezordi.com.br`), um `Set-Cookie` nosso ficaria no domínio errado
  (e cairia no bloqueio de cookie third-party dos navegadores modernos). O
  `tracker.js` guarda o id em `localStorage` no domínio do site (first-party)
  e manda no body de cada chamada.
- **`GET /api/config/public`**: measurement_id/pixel_id ativos, sem auth (não
  são segredo — já ficam visíveis em qualquer página que carregue GA4/Pixel).
  É o que permite o `tracker.js` carregar o gtag.js/Meta Pixel dinamicamente
  sem hardcode.
- **`lib/tracking/dispatch-event.ts`** (`dispatchEvent`) é o disparador
  compartilhado: sempre manda pra todos os `meta_pixels` ativos (dedup via
  `event_id`, hash de PII); só manda pro GA4 via Measurement Protocol quando
  `serverOnly: true` — no fluxo normal do navegador (Fase 3) o `gtag` já
  cobre o GA4, então `/api/event` sempre chama com `serverOnly: false`.
  `serverOnly: true` é reservado pro Purchase do webhook (Fase 4), que reusa
  essa mesma função.
- **Rate limiting**: `/api/identify` (30 req/60s por IP) e `/api/event`
  (60 req/60s por IP), via `check_rate_limit` (`supabase/migrations/0007_rate_limits.sql`).
  Falha aberta (permite a request) se o check em si der erro de infra.
- **CORS**: `lib/cors.ts`, lista em `TRACKING_ALLOWED_ORIGINS` (fallback:
  `tanisexavierdezordi.com.br`/`www.tanisexavierdezordi.com.br`). `/api/config/public` é liberado geral
  (`*`) por não ter dado sensível.
- **Geo**: `lib/tracking/geo.ts` usa `geolocation()` de `@vercel/functions` —
  vazio em `next dev` local, populado em prod/preview na Vercel.
- Testado via curl direto contra o Meta real: hash SHA-256 conferido byte a
  byte (em/ph), `fbp`/`fbc`/IP/UA em texto puro, `test_event_code` aplicado,
  rate limit e CORS validados.

## Webhook de compra Guru (Fase 4)

- Rota `app/api/webhook/guru/[token]/route.ts` — o token vem no **path**, não
  query string (evita vazar em log de proxy/analytics de terceiros).
  Validação por hash SHA-256 + `timingSafeEqual` (não compara os tokens crus:
  tamanhos diferentes fariam o próprio `timingSafeEqual` lançar exceção).
- `lib/guru/process-purchase.ts` é idempotente por `guru_transaction_id`
  (`payload.id`): reenvio do mesmo id faz UPDATE, nunca duplica linha em
  `purchases`. Só dispara Purchase uma vez — controla isso checando se
  `purchase_event_id` já está setado, não o status em si. Isso permite o ciclo
  `pending → approved → refunded` corretamente: dispara no primeiro
  `approved`, e nunca mais redispara (nem quando vira `refunded` depois).
- `lib/guru/status-map.ts`: hoje só `approved`/`confirmed` disparam Purchase.
  **Assumido, não confirmado com venda real da Guru** — ajustar essa lista
  assim que testar com um pagamento de verdade (pix/boleto podem ter status
  intermediário diferente).
- `lib/guru/match-visitor.ts`: cascata `utm_term` (carrega o `trck_user_id`,
  decisão registrada no plano) → `email_hash` → `phone_hash` → `unmatched`.
  Mesmo sem match, a Purchase dispara com o que a Guru mandou (Advanced
  Matching da Meta ainda funciona parcialmente só com email/telefone
  hasheado).
- Reusa 100% o `dispatchEvent` da Fase 3, com `serverOnly: true` — é esse
  flag que liga o disparo GA4 via Measurement Protocol (reaproveitando
  `ga_client_id`/`ga_session_id` do visitante casado, quando há).
- `payload.api_token` (credencial de 40 chars que a Guru manda dentro do
  corpo) **não é usado como validação extra** — decisão de simplicidade,
  nosso `webhook_token` no path já é a proteção primária e suficiente.
- Testado com payloads reais do formato documentado pela Guru: token
  inválido (401), os 3 caminhos de matching, reenvio idempotente (não
  duplica, não redispara), e o ciclo pending→approved→refunded completo —
  todos batendo o resultado esperado, com o Purchase realmente aceito pela
  Meta (`events_received: 1`).

## Dashboard: visão geral, eventos, faturamento (Fase 5)

- Queries agregadas viram **RPC do Postgres** (`count_events_by_name`,
  `funnel_counts`, `billing_summary` — `supabase/migrations/0008_dashboard_functions.sql`),
  não `select *` + agregação em JS: evita puxar toda `events_log`/`purchases`
  pro server só pra contar/agrupar. São `language sql stable` **sem**
  `security definer` — rodam com o privilégio de quem chama (`authenticated`),
  que já teria select via RLS de qualquer forma; só existem por performance.
- Diferente da Fase 2 (que usa `lib/supabase/admin.ts` pra tudo, inclusive
  leitura), as páginas do dashboard usam `lib/supabase/server.ts` (respeita
  RLS, role `authenticated`) — é o padrão certo pra leitura autenticada:
  defesa em profundidade, RLS barra acesso mesmo se algum código esquecer o
  check de auth.
- **`components/ui/dialog.tsx`**: primeira vez que entra Radix
  (`@radix-ui/react-dialog`) no projeto — é exatamente o gatilho que o
  CLAUDE.md já previa desde a Fase 1 ("só entra quando algo realmente
  precisar"). Usado no modal de detalhe do evento
  (`components/dashboard/event-detail-dialog.tsx`), que recebe os dados já
  carregados na query da listagem (sem round-trip extra por linha).
- Funil (Visitou → Checkout → Compra) é uma barra simples via CSS, sem
  Recharts — biblioteca de gráfico só entra quando Campanhas/Geo precisarem
  de verdade (Fase 6).
- Paginação cursor-based por `created_at` (não offset) em Eventos e
  Faturamento — filtros via `<form method="get">` nativo, sem JS de cliente.
- Validado com dados gerados via curl (identify/event/webhook) e conferido
  número a número contra o esperado: funil (8 visitou → 5 checkout 62.5% →
  2 comprou 40%), receita (soma só approved/confirmed, exclui refunded),
  ticket médio, taxa de reembolso — todos batendo exatamente.

## Campanhas e Geo (Fase 6)

- **Matching campanha↔compra: IDs dinâmicos do Meta, não nome.** Como
  `utm_term` já é do `trck_user_id`, os anúncios no Meta Ads Manager
  precisam usar `utm_campaign={{campaign.id}}` e `utm_content={{ad.id}}`
  (parâmetros dinâmicos nativos do Meta) — decisão do usuário, registrada
  aqui porque muda a forma como os anúncios são configurados fora deste
  repo. `revenue_by_campaign()`/`revenue_by_ad()` (migration `0009`) casam
  por esses IDs exatos, nunca por texto.
- `ads_insights_cache` é **cache, não série histórica**: uma linha por
  `(meta_ad_account_id, level, entity_id)`, sobrescrita a cada sync — não
  uma linha por dia. `lib/meta/ads-insights.ts` faz um único fetch em
  `level=ad` (traz campaign_id/adset_id/ad_id juntos) em vez de 3 chamadas
  separadas, mais conservador com o rate limit.
- Receita de campanha vem direto de `revenue_by_campaign` (autoritativa).
  Receita de conjunto (adset) é a **soma dos anúncios filhos** — não temos
  UTM no nível de conjunto de propósito (só campanha+anúncio), então pode
  não bater 100% com a campanha se algum purchase não tiver `utm_content`.
  Documentado em `lib/dashboard/campaign-tree.ts`.
- `app/api/ads-insights/sync/route.ts` é autenticado **dentro do handler**
  (`supabase.auth.getUser()`), não pelo `proxy.ts` — o matcher do proxy
  exclui `/api/*` inteiro (precisa ficar aberto pra `/api/identify`,
  `/api/event`, `/api/webhook/*`), então qualquer rota de API que não seja
  pública tem que se proteger sozinha. Rate limit conservador: 1 sync por
  conta a cada 60 min (`MIN_SYNC_INTERVAL_MINUTES`), nunca automático na
  navegação — sempre via botão "Sincronizar agora".
- **Mapa (Geo)**: `react-simple-maps` original (zcreativelabs) não suporta
  React 19 (sem commits desde jul/2023) — usamos o fork
  `@vnedyalk0v/react19-simple-maps` (mesma API declarativa). Topojson dos
  estados do Brasil vendorizado em `public/br-states.json` (não busca de
  URL externa em runtime).
  **Gotcha**: essa lib tem proteção SSRF que bloqueia fetch HTTP em
  localhost por padrão quando `geography` é passado como **URL string**
  pro `<Geographies>` — `enableDevelopmentMode()` documentado no README
  não resolveu de forma confiável. Solução adotada em
  `components/dashboard/brazil-map.tsx`: buscar e fazer `JSON.parse` do
  topojson manualmente (`fetch` simples, sem a camada de validação da lib)
  e passar o **objeto já parseado** pro `geography` — funciona igual em
  dev e produção, sem depender do modo HTTP/HTTPS.
- Geo agrega por `geo_region` (estado, ISO 3166-2 sem prefixo de país —
  "SP", não "BR-SP") via `visitors_by_region()`. Só populado em
  prod/preview na Vercel (mesma limitação de sempre do `geolocation()`).

## Retenção e auditoria de segurança (Fase 7)

- **Retenção**: `purge_old_event_payloads()` (migration `0010_retention.sql`)
  zera `payload_meta`/`response_meta`/`payload_ga4`/`response_ga4` de
  `events_log` mais velhos que `settings.retention_days` (default 14) —
  em lotes de 5000, teto de 100 lotes/execução (até 500k linhas/dia; um
  backlog inicial maior que isso termina de limpar nos dias seguintes
  sozinho). A linha **nunca é apagada** — data, evento, UTMs e geo continuam
  pro dashboard. Agendado via `pg_cron` (`cron.schedule`, 03:00 UTC diário).
  `purge_old_rate_limits()` limpa `rate_limits` com mais de 1 dia, mesma
  hora (03:15 UTC). Testado manualmente: linha antiga inserida com
  `created_at` forçado, purgada com sucesso (payload zerado, linha mantida),
  linha recente intacta.
- **Cookie de sessão sem `Secure` em produção**: `@supabase/ssr` não seta
  esse flag por padrão. Corrigido em `lib/supabase/cookie-options.ts`
  (`secureCookieOptions`), aplicado em `lib/supabase/server.ts` e
  `lib/supabase/proxy.ts` — força `secure: true` quando
  `NODE_ENV === "production"`. Verificado rodando `next start` localmente
  e inspecionando o header `Set-Cookie` real (antes: sem `Secure`; depois:
  `Secure; SameSite=lax` presente).
- **Auditoria completa** (rodada com um agente dedicado + verificação manual):
  - Nenhum segredo em `NEXT_PUBLIC_*` (só URL e publishable key, ambos
    genuinamente públicos).
  - `lib/supabase/admin.ts` (secret key, bypassa RLS) nunca importado por
    nenhum arquivo `"use client"` — só server actions, Server Components e
    Route Handlers.
  - Todos os módulos server-only de segredo (`admin.ts`, `vault/secrets.ts`,
    `meta/capi.ts`, etc. — 15 arquivos) têm `import "server-only"`.
  - CORS sem wildcard fora do `/api/config/public` (intencional, só expõe
    IDs não-secretos); `/api/identify` e `/api/event` usam allowlist via
    `TRACKING_ALLOWED_ORIGINS`.
  - Nenhum segredo hardcoded no repo; `.env.local` não versionado (só
    `.env.example`, com valores em branco).
  - RLS + policy em todas as 9 tabelas (as 7 originais + `rate_limits` +
    `ads_insights_cache`).
  - Sem `dangerouslySetInnerHTML`/`.innerHTML`/`eval` em todo o código —
    superfície de XSS mínima (mitiga o cookie de sessão não ser `httpOnly`,
    que é assim por design do `@supabase/ssr`: o client do navegador
    precisa ler/gerenciar o cookie diretamente).
  - Cadastro público de usuário desligado no Supabase Auth (confirmado
    manualmente pelo usuário no Dashboard).
  - `npm audit`: 1 vulnerabilidade moderada em `postcss` (XSS em stringify),
    mas é dependência **interna do Next.js** (`node_modules/next/node_modules/postcss`),
    usada só em build-time no nosso próprio CSS estático — não processa
    input de usuário em runtime. O fix sugerido (`npm audit fix --force`)
    rebaixaria o Next.js pra v9, uma regressão inaceitável. **Risco aceito**
    até o Next.js atualizar essa dependência internamente.

## Deploy (Vercel)

- Repo no GitHub: `TaniseX/track.tanisexavierdezordi.com.br`
  (`https://github.com/TaniseX/track.tanisexavierdezordi.com.br.git`),
  conectado à Vercel (auto-deploy a cada push em `main` — configurar na
  importação do projeto pela UI da Vercel). Nome/URL de produção do projeto
  na Vercel ainda não definidos aqui.
- **Gotcha de plano Hobby + repo privado** (se o repo GitHub for privado): a
  Vercel bloqueia deploy automático (`Deployment Blocked`) se o autor do
  commit não for reconhecido como colaborador do projeto — só afeta deploys
  disparados por `git push` (o primeiro deploy, feito importando o projeto
  pela UI da Vercel, não passa por essa checagem). Se acontecer, ajustar
  `git config --local user.email` neste repo pro email da conta GitHub dona
  do projeto (é `--local`, não `--global` — não afeta outros repos na
  máquina).
- Env vars de produção (Vercel → Settings → Environment Variables, escopo
  Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `TRACKING_ALLOWED_ORIGINS` (default sugerido: `*.tanisexavierdezordi.com.br`).
  Projeto Supabase: `vbziznklmhckrkvrqghr` — credenciais em `.env.local`
  (não versionado), migrations em `supabase/migrations/` ainda precisam ser
  coladas manualmente no SQL editor (ver seção Migrations), nessa ordem.
- Não existe "banco de produção" separado — o mesmo projeto Supabase serve
  dev local e produção.

## Site principal em múltiplos subdomínios (pós-deploy)

O site (`tanisexavierdezordi.com.br`) roda em vários subdomínios — o fluxo
principal de captação é `movimentosemdor.tanisexavierdezordi.com.br` ("Movimento Sem
Dor", programa online), além de possíveis `checkout.tanisexavierdezordi.com.br`
etc (páginas geradas por outras ferramentas, fora deste repo). Isso já é
coberto pelo `tracker.js`/CORS desde o início (herdado do projeto anterior
que motivou essas decisões):

- **`trck_user_id` fica em cookie de domínio raiz** (`domain=.tanisexavierdezordi.com.br`),
  não só `localStorage`. `localStorage` é isolado por subdomínio — sem o
  cookie, o id "resetava" toda vez que o visitante trocava de subdomínio na
  mesma jornada (ex: coluna → checkout). `public/tracker.js` deriva o domínio
  raiz do próprio `location.hostname` (pega os 2 últimos labels; `localhost`/IP
  não setam `domain` no cookie, pra funcionar em teste local). Fallback pra
  `localStorage` mantido (navegadores que bloqueiam cookie de terceiro
  primeiro-domínio, modo privado etc).
  **Limitação conhecida**: Safari ITP limita a 7 dias cookies escritos via
  `document.cookie` quando classificados como tracking (mesma limitação que
  o próprio `_fbp`/`_fbc` do Meta Pixel sofrem) — sem workaround client-side
  limpo. O fallback de matching por email/telefone no webhook (Fase 4) cobre
  esse caso quando o cookie expira antes da compra.
- **CORS por wildcard de domínio raiz**, não lista fixa de origins.
  `lib/cors.ts` aceita padrões `*.dominio.com` em `TRACKING_ALLOWED_ORIGINS`
  (default: `*.tanisexavierdezordi.com.br`) — casa o domínio raiz e qualquer subdomínio,
  sem precisar adicionar cada subdomínio novo manualmente. Testado contra
  tentativa de bypass (`tanisexavierdezordi.com.br.malicioso.com` corretamente rejeitado).
- **Instalação**: a tag `<script src="https://track.tanisexavierdezordi.com.br/tracker.js" async>`
  precisa estar em toda página rastreada, em todo subdomínio — mesma exigência
  de qualquer pixel/analytics. Se a ferramenta que gera as páginas tiver
  injeção de script global por site, usar isso; senão, colar manualmente em
  cada página.

## Identidade visual (rebrand pra Tanise Xavier de Zordi)

Este repo nasceu como cópia do sistema de tracking construído antes pra
`track.advflowpro.com` (mesma stack, mesmo schema, mesmas fases 1-7 —
histórico preservado abaixo pra referência de como cada peça foi construída
e testada). Adaptado pra esta cliente: paleta, wordmark, CORS/cookie de
domínio e credenciais Supabase trocados; lógica e schema mantidos 1:1.

- **Paleta**: extraída via `curl` do CSS buildado de `tanisexavierdezordi.com.br`
  (variáveis `--primary`/`--green-700`, mesmo tom usado no gradiente do botão
  de WhatsApp do site: `hsl(158 65% 34%)` = `#1e8f66`, verde floresta) —
  não escolhida à parte. Fundo continua dark quase preto (zinc-950,
  `240 10% 4%`) e texto zinc-50, mesmo padrão do projeto anterior; só a
  **primária** virou esse verde (era ciano). No tema escuro a
  primária sobe pra `158 75% 48%` (`#1fd693`) só pra manter contraste sobre
  o zinc-950 — mesmo tipo de ajuste luz→escuro que já existia. `--amber`
  continua só cor utilitária de status (badge "partial"), sem ligação com
  marca. `movimentosemdor.tanisexavierdezordi.com.br` (fluxo principal) usa um verde
  mais vibrante (`#00a876`) no próprio design system dela — não usado aqui,
  o painel segue a paleta do site principal por decisão do usuário.
- **Logo real recebido e aplicado** (`Logo Dra. Tanise Xavier.png`, enviado
  pela cliente — 1080×1080, fundo branco sólido, selo circular verde com
  monograma "tw"/coluna estilizada + "TANISE XAVIER" no arco inferior).
  Processado com `sharp` (script one-off, não versionado): recortado pro
  bbox do conteúdo (remove a margem branca excessiva) e o fundo branco
  removido via chave de cor (`alpha = 255 - min(r,g,b)` por pixel — funciona
  bem aqui porque o traço é colorido sobre branco puro, sem branco usado de
  propósito dentro do próprio desenho). Resultado: `public/brand/logo.png`
  (512×512, transparente).
- `app/icon.png`/`app/apple-icon.png`: o logo transparente **composto sobre
  fundo dark sólido** (`#09090b`, 32×32 e 180×180) — favicon transparente
  some em toolbar clara do navegador, mesmo motivo do projeto anterior.
  Convenção de arquivo do Next.js App Router; substituíram os
  `icon.tsx`/`apple-icon.tsx` que geravam o monograma "TX" via `next/og`
  (removidos, não fazem mais sentido com o asset real disponível).
- **`components/layout/logo.tsx`**: agora é `<Image src="/brand/logo.png">`
  direto, sem chip de fundo fixo — diferente do wordmark em texto anterior
  (que precisava de `bg-[#09090b]` pra o texto branco ficar legível), o logo
  transparente funciona nos dois temas do painel sem embrulho nenhum. Usado
  em `Sidebar`, `MobileNav` e `LoginPage` (maior, `h-14 w-14`, nesse último).

## Lead/InitiateCheckout em popups de LP + ajustes de painel (pós-deploy)

- **`window.trckCheckoutUrl(url)`** (função disponível no `tracker.js`, herdada
  do projeto anterior): pensada pra LPs com popup de lead (nome/whatsapp/email)
  embutido na própria página — quando não é um `<a href>` estático e o
  próprio JS da LP faz `window.location.href = <url>` depois do submit, nem
  o `trck_user_id` (via `utm_term`) nem as utms da LP chegariam no checkout
  automaticamente (mais ainda se o checkout usar domínio raiz **diferente**
  de `tanisexavierdezordi.com.br` — aí o cookie de domínio raiz não ajuda).
  `trckCheckoutUrl` resolve isso: recebe a url de checkout e devolve (via
  Promise) a mesma url com `utm_source/utm_medium/utm_campaign/utm_content`
  capturados na LP + `utm_term=trck_user_id` anexados. Documentado no
  cabeçalho do próprio `tracker.js`, com a receita de uso (`trackEvent("Lead")`
  no submit, `trckCheckoutUrl` + `trackEvent("InitiateCheckout")` antes do
  redirect). Se `movimentosemdor.tanisexavierdezordi.com.br` tiver um popup desse tipo,
  aplicar essa receita é responsabilidade de quem edita a LP (fora deste
  repo) — ainda não confirmado se é o caso aqui.
- **Webhook da Guru**: além de "Gerar novo token" (aleatório), agora dá pra
  colar um token customizado e salvar (`WebhookTokenForm` +
  `setWebhookToken` action) — mesma tabela/Vault por baixo, só mais uma forma
  de definir o valor.
- **`meta_test_event_code`** saiu do card "Geral" de Configurações e foi pra
  dentro de `/configuracoes/meta-pixels` (é usado só pelo teste de conexão
  de pixel, fazia mais sentido ali do que num card genérico).
- **Geo**: além de estado (mapa + `visitors_by_region`), agora tem país
  (`visitors_by_country`) e cidade (`visitors_by_city`) — migration `0011`.
- **Funil de conversão**: ganhou a etapa "Lead" (`visited → lead → checkout →
  purchase`, também na migration `0011`) e o layout trocou de barras de
  progresso pra um funil de verdade (`FunnelSteps` em
  `components/dashboard/funnel-steps.tsx`), desenhado com `<polygon>` SVG
  (trapézios com largura proporcional à contagem de cada etapa, opacidade
  decrescente).
- **Horários errados no painel**: `lib/format.ts#formatDateTime` usava
  `toLocaleString("pt-BR")` sem `timeZone` explícito — como a Vercel roda em
  UTC, os horários apareciam 3h adiantados. Fix: `timeZone: "America/Sao_Paulo"`
  fixo (a coluna `settings.timezone` existe no schema mas nunca foi
  conectada a nada — não vale a pena tornar isso dinâmico sem necessidade
  real de suportar múltiplos fusos).
Migration `0011` já aplicada em produção (confirmada: `funnel_counts`/
`visitors_by_country`/`visitors_by_city` rodando com dado real).

## Filtro de data global + reestruturação do painel (pós-deploy)

- **Onde mora o filtro**: cookie `trck_range` (`today` | `7d` | `30d` |
  `custom:YYYY-MM-DD:YYYY-MM-DD`), escrito por `components/layout/date-range-filter.tsx`
  (no `Topbar`, visível em toda página autenticada) e lido no server por
  `lib/dashboard/date-range.ts#getDashboardDateRange()`. Cookie, não
  querystring — rotas do dashboard são separadas (App Router), então um
  cookie lido automaticamente em cada `page.tsx` evita ter que colar o
  parâmetro em todo `<Link>` do nav. Sem cookie → "hoje" (default). Datas
  calculadas com offset fixo `America/Sao_Paulo` (`-03:00`, sem horário de
  verão desde 2019 — não precisou de lib de timezone nova).
  `lib/dashboard/date-range-shared.ts` existe só pra guardar a constante do
  nome do cookie + o tipo, porque `date-range.ts` é `"server-only"` e não
  pode ser importado pelo client component do filtro.
- **RPCs viraram date-aware**: `funnel_counts`, `count_events_by_name`,
  `billing_summary`, `visitors_by_region/country/city` (migration `0012`)
  passam a aceitar `date_from`/`date_to timestamptz` opcionais. Como as
  versões antigas tinham zero parâmetros, foi preciso `drop function` antes
  de recriar — senão o Postgres trata como sobrecarga nova e a chamada sem
  argumento (ex: de código antigo/cache) fica ambígua pro PostgREST.
  `revenue_by_campaign`/`revenue_by_ad` (usadas só na aba Campanhas)
  ficaram de fora — Campanhas continua com o cache de 30 dias do
  "Sincronizar agora", não entra no filtro global (decisão registrada no
  plano: não criar cache histórico diário nem cron novo pra isso).
- **Gasto/receita/ROAS na Visão Geral busca a Meta ao vivo**
  (`lib/dashboard/live-ad-spend.ts`, reusa `fetchAdInsights` da Fase 6),
  sob demanda a cada carregamento da página, já com `time_range` = período
  selecionado — decisão explícita do usuário (a alternativa seria um cache
  histórico diário com cron novo, mais robusto porém bem mais trabalho e
  contra a filosofia atual de "nunca sincroniza sozinho").
- **Funil voltou a 3 etapas** (Visitou → Iniciou checkout → Comprou) na
  Visão Geral — a etapa "Lead" que tinha sido adicionada saiu do funil (já
  aparece nos cards do topo e na aba Páginas), mas o layout em trapézios
  SVG (`components/dashboard/funnel-steps.tsx`) foi mantido.
- **Geo entrou na Visão Geral** (mapa + país/estado/cidade, mesmas RPCs) —
  a aba `/geo` separada continua existindo, agora também com o filtro de
  data aplicado.
- **Aba Eventos**: coluna de Geo (cidade/estado/país direto de
  `events_log`) e coluna de Origem (nome de campanha/conjunto/anúncio
  resolvido contra `ads_insights_cache` via `lib/dashboard/resolve-campaign-names.ts`
  — busca em lote, 1 query por nível pra página inteira, não por linha;
  cache desatualizado/vazio cai pro ID cru). Cor por tipo de evento
  (`lib/dashboard/event-colors.ts`, mapa fixo + fallback hash pra eventos
  futuros não mapeados).
- **Drawer de visitante**: clicar no ícone de usuário da linha (não mais
  "Ver detalhes" direto) abre `components/dashboard/visitor-drawer.tsx`
  num painel lateral direito novo (`components/ui/sheet.tsx` — mesma base
  do `dialog.tsx`, `@radix-ui/react-dialog` já era dependência, só
  ancorado à direita em vez de centralizado; sem lib nova). Mostra o
  perfil completo do visitante + histórico de eventos dele (com as utms de
  cada evento, que podem diferir da atribuição original). Clicar num
  evento do histórico abre o `EventDetailDialog` já existente (payload
  Meta/GA4) — o clique em duas camadas é intencional (lista → payload sob
  demanda). Dados vêm de uma Server Action (`getVisitorDetail` em
  `app/(dashboard)/eventos/actions.ts`), não de uma Route Handler — já usa
  `lib/supabase/server.ts` (RLS), mesmo padrão de auth das outras páginas
  do dashboard, sem precisar de check manual extra.
- **Faturamento** ganhou coluna com as 5 utms de origem de cada compra
  (já existiam em `purchases`, só não eram exibidas).
- **Aba nova: Páginas** (`/paginas`) — taxa de conversão por URL de LP
  (visualizações, únicos, leads, checkout, compras), agrupada sem
  querystring (`split_part(event_source_url, '?', 1)` — utms diferentes da
  mesma LP não fragmentam a linha). Compra não tem URL própria (nasce no
  webhook, fora do navegador) — herda a `landing_url` do visitante casado
  via `page_funnel()` (migration `0012`).
- **Pendente**: migration `0012_dashboard_date_filters.sql` ainda precisa
  ser colada no SQL editor do Supabase — sem ela, o filtro de data quebra
  todas as páginas do dashboard (RPCs chamadas com `date_from`/`date_to`
  que ainda não existem no banco).

## Redesign visual da Visão Geral (pós-deploy)

- **Recharts** entrou como primeira (e única) biblioteca de gráfico do
  projeto — mapa (`react19-simple-maps`) e funil continuam SVG na mão, mas
  o card "Receita e investimento por dia" (linha/área com duas séries,
  eixos, tooltip) não valia a pena reinventar. Componente em
  `components/dashboard/revenue-chart.tsx`, `"use client"` (Recharts não
  roda em Server Component). Usa `hsl(var(--primary))`/`hsl(var(--amber))`
  em vez de cor fixa, pra seguir tema claro/escuro automaticamente.
- **Investido por dia** vem ao vivo da Meta com `time_increment=1`
  (`lib/meta/ads-insights.ts#fetchDailySpend`, `level=account` — só
  precisa do total por dia, não por anúncio) — mesma filosofia "sem cache
  histórico nosso" já usada no gasto agregado da Fase anterior.
  **Receita por dia** vem de `revenue_by_day()` nova (migration `0013`).
- **Filtro de data**: ganhou `90d` como 4º botão fixo, e a opção
  "Personalizado" saiu do controle segmentado — agora é um botão/pill
  separado sempre visível ao lado dos 4 fixos (mostra o intervalo escolhido
  quando ativo). Mesmo cookie `trck_range` por baixo, só mudou a UI.
- **Funil**: voltou a ser SVG com barras trapezoidais plenas (como a
  primeira versão), mas agora com nome+número **centralizados dentro de
  cada barra** via `<foreignObject>` (não numa lista/coluna separada) —
  terceira iteração de layout desse componente nesta rodada de ajustes
  pós-deploy, essa é a que o usuário validou como definitiva.
- **`MetricCard`** ganhou prop opcional `icon` (círculo com o ícone no
  canto do card) — aditivo, não quebra o uso em Faturamento.
- **Geo em 4 colunas iguais** (Mapa, Países, Estados, Cidades) tanto na
  Visão Geral quanto na aba `/geo` — antes era mapa maior + coluna
  lateral empilhada.

## Captura de identidade do lead (pós-deploy)

- `visitors` não tinha coluna `name` (migration `0014`) — só o popup de
  lead das LPs coleta nome, e não existia lugar pra guardar.
- `/api/event` (`eventSchema`) passa a aceitar `name`/`email`/`phone`
  opcionais no body e, quando presentes, **sempre sobrescreve** esses
  campos no `visitors` (diferente do backfill de `fbp`/`fbc` — que só
  preenche se estiver vazio — aqui é a mesma filosofia do `/api/identify`:
  o dado mais recente informado pelo próprio visitante é o que vale).
  `email_hash`/`phone_hash` recalculados junto via `lib/meta/hashing.ts`.
  Sem isso, um `trckCheckoutUrl`/`trackEvent("Lead")` de LP com popup de
  lead dispara o evento certo, mas com `{}` vazio — nunca manda os dados do
  formulário pro nosso lado, só pro sistema de LP/CRM em uso.
- `components/dashboard/visitor-drawer.tsx` mostra "Nome" (e já mostrava
  email/telefone, que só ficavam vazios pela mesma causa acima).
- **Pendente do lado da LP** (se `movimentosemdor.tanisexavierdezordi.com.br` tiver um
  popup de lead): a chamada precisa ser
  `window.trackEvent("Lead", { name, email, phone })` com os dados do
  formulário — não confirmado ainda se essa LP usa esse padrão nem quais os
  nomes reais dos campos no bundle dela; checar quando for integrar.

## Webhook da Guru: token corrompido + timeout de entrega (pós-deploy)

- **Token corrompido via UI**: `WebhookTokenForm` (`components/config/webhook-token-form.tsx`)
  só validava tamanho mínimo (16 chars) — alguém colou a URL inteira do
  webhook (em vez de só o token) no campo "Definir token manualmente" e
  isso foi salvo como token válido, quebrando a comparação em
  `app/api/webhook/guru/[token]/route.ts` (sempre 401, silenciosamente,
  sem nenhuma pista óbvia até inspecionar o valor cru no Vault). Corrigido
  manualmente restaurando o token limpo — considerar validar formato
  (rejeitar `http`/`/`) nesse campo se acontecer de novo.
- **Timeout de entrega do lado da Guru**: mesmo com o token certo, a Guru
  reportava "Erro ao disparar webhook" sem nenhum código HTTP — sinal
  clássico de timeout de conexão (a Guru desiste antes de receber
  resposta), não de erro de aplicação. Causa: `processGuruPurchase`
  esperava (`await`) terminar de disparar Purchase pro Meta CAPI **e**
  GA4 Measurement Protocol — chamadas de rede externas — antes de
  responder à Guru. Numa function fria (Vercel), a soma passava do
  timeout que a Guru tolera.
  **Fix**: `lib/guru/process-purchase.ts` agora responde assim que a
  compra está gravada no Postgres (rápido); o disparo pro Meta/GA4
  (`dispatchPurchaseEvent`) roda depois, via `waitUntil()` de
  `@vercel/functions` (mesmo pacote já usado pra `geolocation()`) — estende
  a vida da function além da resposta, sem bloquear o webhook. Erros nesse
  disparo em segundo plano só vão pro log (`console.error`), não afetam a
  resposta já enviada.
- **`guruWebhookSchema` rejeitava o payload real da Guru** (400 "Invalid
  input: expected string, received null") — descoberto só com uma venda
  real, confirmado no log de entregas da própria Guru. A Guru manda `null`
  explícito (não omite o campo) em opcionais sem valor — `dates.canceled_at`
  antes de cancelar, `source.utm_source/utm_medium/utm_campaign/utm_content`
  quando a venda não veio de link com utm (só `utm_term`, que carrega o
  `trck_user_id`, sempre vem preenchido nas vendas via nosso link de
  checkout). `.optional()` do Zod só aceita o campo *ausente*, não `null` —
  trocado pra `.nullable().optional()` em todo campo opcional do schema
  (`lib/guru/webhook-schema.ts`). `process-purchase.ts` não precisou mudar:
  já tratava ausência de valor com `?? null`/`||`, que também cobre `null`
  de verdade.
- **Purchase do webhook nunca gravava geo em `events_log`** — o insert em
  `dispatchPurchaseEvent` (`lib/guru/process-purchase.ts`) tinha utm_* mas
  esqueceu `geo_country/region/city`. Corrigido copiando do visitante
  casado (`match.visitor.geo_*`, mesmo padrão já usado ali pra
  `fbp`/`fbc`/`ga_client_id`) — a Guru não manda geo estruturado, só IP cru
  em `infrastructure.ip`, então usar o geo já capturado na navegação
  (via Vercel) é mais direto que geolocalizar o IP de novo.
- **Geo (mapa/país/estado/cidade) filtrava por `visitors.created_at`**
  (primeira vez que o visitante apareceu) em vez de atividade no período —
  um visitante recorrente, criado num dia anterior mas ativo hoje, ficava
  fora do filtro "Hoje" mesmo gerando eventos hoje (os eventos em si
  mostravam o geo certo, só a agregação do mapa que excluía). Migration
  `0015`: `visitors_by_region/country/city` passam a filtrar por
  `last_seen_at` (atualizado em todo `/api/identify`), não `created_at`.
- **Eventos**: coluna de valor só mostra pra `Purchase` — `InitiateCheckout`
  carrega `value`/`currency` (útil pro Meta CAPI/otimização de anúncio),
  mas não é receita de verdade, só o preço do produto no momento do clique;
  exibir ali ao lado de Purchase confundia. Continua salvo no evento, só
  não aparece na tabela.
- **Todo o histórico de eventos de um visitante mostrava sempre a mesma
  utm** — `/api/event` gravava `utm_source/medium/campaign/term/content`
  em `events_log` a partir de `visitor.utm_*` (a atribuição da primeira
  visita, que quase nunca muda depois — `/api/identify` só sobrescreve
  quando um valor novo está presente), não da página que gerou aquele
  evento específico. `tracker.js` nem mandava utm nenhuma no corpo de
  `trackEvent()`. Corrigido: `trackEvent()` agora manda as utms da página
  atual (mesma captura de `CAPTURED_UTMS` já usada no `identify()`), e
  `/api/event` grava exatamente o que veio no evento, **sem** cair pro
  fallback do visitante — se a visita não tiver utm nenhuma, o evento
  grava `null` mesmo (reflete a jornada real). `process-purchase.ts` (Fase
  4) já fazia certo desde o início, usando `payload.source?.utm_*` da
  própria transação da Guru.

## Event Match Quality: fn/ln/geo no user_data da Meta (pós-deploy)

- **Auditoria**: comparado o que a Meta documenta como "Customer Information
  Parameters" da Conversions API com o que o sistema mandava — `em`, `ph`,
  `fbp`, `fbc`, `external_id`, IP e UA já estavam certos; faltavam `fn`/`ln`
  (nome) e `ct`/`st`/`zp`/`country` (geo), mesmo já capturando esses dados.
- **Normalização exigida pela Meta** (`lib/meta/hashing.ts`): remove acento
  (`stripAccents`, via `.normalize("NFD")` + `\p{Diacritic}`), minúsculo,
  e pra `ct` especificamente remove **todo espaço** também (a Meta trata
  "New York City" como "newyorkcity"). `st`/`zp`/`country` seguem a mesma
  regra de remover espaço. `splitName()` separa nome completo em
  fn (1º token) / ln (resto) — não tenta ser mais esperto que isso.
- **`/api/event`**: geo vem do `getGeo(request)` de cada request (não do
  visitante) — mais preciso pra aquele evento específico. Nome vem de
  `input.name ?? visitor?.name`.
- **Purchase (webhook Guru)**: precisou abrir `contact.address_city/state/
  zip_code/country` e `infrastructure.city/region/country` no
  `guruWebhookSchema` (`lib/guru/webhook-schema.ts`) — não estavam
  mapeados, então o schema descartava esses campos mesmo a Guru mandando
  (só o `raw_payload` cru preservava). Prioridade do geo:
  `contact.address_*` (endereço declarado pelo comprador, mais confiável)
  → `infrastructure.*` (geo por IP no momento da compra) → geo do
  visitante casado (navegação anterior, pode estar desatualizado). Mesma
  prioridade usada tanto no `user_data` da Meta quanto no
  `geo_country/region/city` gravado em `events_log` pro Purchase.

## Tráfego interno (pós-deploy)

- **Motivação**: a equipe testando o próprio funil (cliques, leads, até
  compra de teste) estava poluindo o painel e sendo enviada como conversão
  real pro Meta/GA4 — poluindo a otimização de anúncio.
- **Mecanismo**: tabela `internal_ips` (migration `0016`, gerenciada via
  Configurações → Tráfego interno, sem precisar de migration nova por IP
  cadastrado). `lib/tracking/internal-ips.ts#isInternalIp()` é checado bem
  no início de `/api/identify`, `/api/event` e do webhook da Guru — se o
  IP bater, a resposta continua normal (o cliente/a Guru não percebem
  nada), mas **nada é gravado no banco nem disparado pro Meta/GA4**. Não é
  só "esconder do painel" — é não processar de verdade.
- **Por IP, não por `trck_user_id`**: um teste novo gera um `trck_user_id`
  novo a cada vez (cookie limpo, aba anônima, dispositivo diferente) — IP
  é o que realmente identifica "essa pessoa/rede" de forma persistente pra
  esse propósito.
- **Webhook da Guru**: usa `infrastructure.ip` do payload (IP do comprador
  no momento da compra), não o IP de quem chama o webhook (que é sempre da
  própria Guru).
- **Limitação conhecida**: se a pessoa marcada como interna quiser fazer
  uma compra real que deve contar (ex: comprar pra revisar a experiência
  do cliente), ela não vai ser rastreada enquanto o IP dela estiver na
  lista — precisa remover o IP antes, ou testar de outra rede.

## Tráfego de bots/infra da Meta (pós-deploy)

- **Motivação**: investigando um volume de acessos geolocalizados nos EUA sem
  campanha rodando lá, identificamos dois padrões distintos misturados: (a)
  bots reais da própria Meta (`facebookexternalhit`/`meta-externalads`,
  crawler de preview de link, dispara sozinho quando um link vira anúncio/é
  compartilhado — não é visitante real) e (b) cliques reais em anúncios
  próprios, com `utm_campaign`/`fbclid` genuínos e User-Agent do app
  Instagram/Facebook com locale `pt_BR`, cujo IP cai em faixas que pertencem
  à própria Meta (AS32934) — o navegador embutido do app (in-app browser) às
  vezes proxeia a requisição inicial pela infra da Meta antes de repassar pro
  nosso servidor, fazendo o `geolocation()` da Vercel detectar o datacenter
  da Meta em vez do celular do usuário real. O usuário decidiu excluir os
  dois casos: não é só o bot que deve sumir, é qualquer tráfego cuja origem
  seja a própria infraestrutura da Meta (mesmo quando o clique em si é real).
- **Mecanismo**: tabela `meta_ip_ranges` (migration `0017`) com as faixas
  CIDR publicadas do AS32934 (~260 faixas IPv4 + 2 blocos-mãe IPv6, via BGP —
  `bgp.he.net/AS32934`, snapshot de 2026-07-14, **sem sync automático**,
  mesma filosofia do `br-states.json` vendorizado: lista estática, atualizar
  manualmente se necessário) + função `is_meta_ip(check_ip text)` (`<<=` do
  tipo `cidr`, sem índice GiST — poucas centenas de linhas, scan sequencial
  já é rápido o bastante nesse volume). `lib/tracking/meta-bot-traffic.ts#isMetaBotTraffic(ip, userAgent)`
  combina checagem de UA (regex pros bots conhecidos) + `is_meta_ip` via RPC,
  checado no mesmo ponto e com o mesmo efeito que `isInternalIp` em
  `/api/identify`, `/api/event` e no webhook da Guru — resposta segue normal,
  nada é gravado nem disparado pro Meta/GA4.
- **Escopo deliberadamente restrito à Meta**: não filtra Bingbot/Googlebot
  (não pedido) — só os dois critérios explícitos do usuário: bots da própria
  Meta e IPs da própria Meta.
- **Limpeza do histórico**: rodada uma vez, manual (não é uma migration —
  dado, não schema): identificados via UA/IP os visitantes já gravados que
  bateriam nos critérios acima, apagados 70 visitantes e 54 eventos (0
  purchases — nenhuma compra tinha vindo de IP da Meta).

## Webhook de compra Kiwify (pós-deploy)

- **Descoberta**: o checkout real dessa cliente é **Kiwify**, não Guru — o
  sistema inteiro (webhook, matching, schema) foi herdado do projeto anterior
  pronto pra Guru. `app/api/webhook/kiwify/[token]/route.ts` +
  `lib/kiwify/*` foram adicionados **em paralelo** ao webhook da Guru
  (`app/api/webhook/guru/[token]/route.ts` continua existindo, intocado —
  não removido, caso volte a ser necessário).
- **Mesmo segredo, path diferente**: a Kiwify não usa um mecanismo de
  assinatura/token próprio conhecido — a segurança vem do path secreto na
  URL, mesmo padrão da Guru. Reaproveita o **mesmo** `webhook_token_id` já
  cadastrado em Configurações (não precisou de migration nova). Pra ativar:
  em Kiwify → Configurações → Webhooks → Criar webhook, colar como URL:
  `https://track.tanisexavierdezordi.com.br/api/webhook/kiwify/<token>`
  (o mesmo token que já aparece na URL do webhook da Guru em Configurações).
  Trigger a marcar: pelo menos `compra_aprovada` (e `compra_reembolsada`/
  `chargeback` se quiser refletir estorno, embora hoje isso só atualize o
  status sem re-disparar nada — mesma filosofia da Guru).
- **Formato do payload CONFIRMADO** via um teste real (botão "Testar
  Webhook" no painel da Kiwify, 2026-08-31 — payload de exemplo da própria
  Kiwify, "Example product"/"John Doe", mas com a estrutura real). Campos
  confirmados: `order_id`, `order_status` (enum oficial da OpenAPI —
  `paid | pending | refused | chargeback | refunded`), `webhook_event_type`
  ("order_approved" no teste), `payment_method` (top-level), `created_at`/
  `approved_date`/`refunded_at` (formato `"YYYY-MM-DD HH:MM"`, sem timezone
  explícito — assumido UTC), `Customer` (`full_name`, `first_name`, `email`,
  `mobile`, `ip`, `city`, `state`, `zipcode`, `cnpj` — **sem campo de país**,
  assumido `"BR"`), `Product.product_id`/`product_name`, `Commissions`
  (`charge_amount`, `product_base_price`, `currency`), `TrackingParameters`
  (`utm_source/medium/campaign/term/content`, `src`, `sck`, `s1-s3`).
  `lib/kiwify/webhook-schema.ts` continua com schema frouxo (`z.record` +
  `pick()`/`pickString()`/`pickNumber()` tentando múltiplos nomes) de
  propósito — não porque o formato seja incerto agora, mas porque a Kiwify
  pode mandar payloads ligeiramente diferentes por trigger (venda normal vs
  assinatura vs reembolso) e o objetivo é nunca rejeitar por formato
  inesperado; `raw_payload` sempre guarda o JSON cru.
- **Valores monetários em CENTAVOS** — `Commissions.charge_amount`/
  `product_base_price` vêm como inteiro sem casas decimais (`3584` no
  teste). Não documentado explicitamente em lugar nenhum acessível, mas
  inferido com boa confiança (exemplos da própria doc oficial só fazem
  sentido como centavos: preços de curso na casa de centenas de reais, não
  dezenas de milhares) e batendo com o valor de uma assinatura semanal
  plausível no teste real (`R$35,84`/semana, não `R$3.584`/semana).
  `lib/kiwify/process-purchase.ts` divide por 100 antes de gravar
  `gross_value`/`net_value` e antes de mandar `value` pro Meta CAPI/GA4.
  **Conferir contra uma venda de verdade** (comparar Faturamento no painel
  vs valor exibido no painel da Kiwify) assim que houver uma — se estiver
  errado, é só remover a divisão.
- **Event Match Quality**: `dispatchPurchaseEvent` manda o máximo de sinal
  disponível — `Customer.ip` como `client_ip_address`, endereço declarado
  (`Customer.city/state/zipcode`, país assumido `"BR"`) tem prioridade sobre
  o geo do visitante casado (mesma prioridade usada na Guru:
  declarado-pelo-comprador > navegação anterior). Sem `user_agent` (não
  existe campo equivalente confirmado no payload da Kiwify).
- **Reaproveita `purchases.guru_transaction_id`** pra guardar o `order_id`
  da Kiwify — nome da coluna ficou desatualizado (só fazia sentido quando só
  existia Guru), mas como só um provedor de checkout está ativo por vez, não
  há colisão de verdade. Renomear a coluna exigiria migration nova; adiado
  até ter motivo real (os dois provedores ativos ao mesmo tempo, por
  exemplo).
- **`matchVisitor` reaproveitado de `lib/guru/match-visitor.ts`** (importado
  direto, não duplicado) — a função já era 100% genérica (cascata
  trck_user_id → email → telefone → unmatched via hash), apesar do nome da
  pasta. Idem `dispatchEvent`/`hashing`/`splitName` — zero duplicação de
  lógica de disparo entre os dois webhooks.
- **`trck_user_id` não chega no payload hoje**: o link de checkout na LP
  (`movimentosemdor.tanisexavierdezordi.com.br`) é **estático e hardcoded**
  (`kiwifyCheckout: "https://pay.kiwify.com.br/j8e749d"` no bundle da LP,
  confirmado inspecionando o JS), sem nenhuma utm anexada — o teste real
  confirma isso: `TrackingParameters` existe no payload (campo real,
  confirmado), mas veio com todos os valores `null` (`utm_term`, `src`,
  etc), exatamente porque não havia utm nenhuma na URL de checkout usada no
  teste. Matching por `trck_user_id` só vai funcionar quando o link virar
  dinâmico — matching por email/telefone continua funcionando normalmente
  (fallback já usado quando `utm_term` falta). **Ainda não confirmado**:
  se a Kiwify de fato ecoa em `TrackingParameters` as utms que estavam
  presentes na URL de checkout no momento da compra (só testamos com URL
  sem utm nenhuma) — **pendente do lado da LP**: trocar o link estático por
  um montado com `window.trckCheckoutUrl()` (já documentado na seção
  "Lead/InitiateCheckout em popups de LP") e então testar de novo com utms
  reais na URL pra confirmar que aparecem no webhook.
- **Testado uma vez** (botão "Testar Webhook" da Kiwify, 2026-08-31): chegou,
  passou pelo `webhook_token`, `order_status`/`webhook_event_type`
  reconhecidos como venda aprovada, `purchases` gravado, Purchase disparado
  pro Meta CAPI com sucesso (`events_received: 1`). Registro de teste
  apagado do banco depois (dado fake, não uma venda real). **Ainda não
  testado**: uma venda de verdade (valor/CPF/endereço reais, ciclo completo
  incluindo GA4 — o teste não disparou GA4 porque não havia visitante
  casado, logo sem `ga_client_id`) nem os triggers de reembolso/chargeback.

## PageView em navegação de SPA (pós-deploy)

- **Motivação**: pedido pra Termos de Uso/Política de Privacidade
  aparecerem no painel quando visitadas — investigando, `movimentosemdor.tanisexavierdezordi.com.br`
  é uma SPA (React Router, mesmo `index.html`/bundle servido pra qualquer
  path, confirmado testando rotas inexistentes — todas devolvem o mesmo
  HTML). `tracker.js` só disparava `PageView` **uma vez**, na carga inicial
  do script — navegar pra outra rota via link interno (sem reload de
  página) nunca disparava PageView novo pra essa URL, então qualquer página
  visitada só por navegação interna (não só Termos/Privacidade — qualquer
  rota do site) ficava com o PageView atribuído à URL de entrada, nunca à
  URL real visitada.
- **Fix em `public/tracker.js`**: técnica padrão de scripts de analytics em
  SPA — intercepta `history.pushState`/`history.replaceState` (como React
  Router e a maioria dos client-side routers mudam a URL por baixo) +
  escuta `popstate` (botão voltar/avançar do navegador), comparando a URL
  antes/depois pra disparar `PageView` de novo só quando ela realmente
  muda. Não precisa de nenhuma chamada manual por página nova — funciona
  pra Termos de Uso, Política de Privacidade e qualquer rota futura do site
  automaticamente, sem precisar tocar em código da LP.
- **Sem migration nem mudança de schema** — `event_name`/`event_source_url`
  já eram genéricos, só faltava o `tracker.js` disparar no momento certo.

## Estado atual

Código herdado 1:1 do sistema construído pra `track.advflowpro.com` (fases
1-7 completas lá — retenção, auditoria de segurança, deploy, filtro de data
global, Visão Geral com gráfico de receita/investimento via Recharts, funil,
geo em 4 colunas, Eventos com drawer de visitante, aba Páginas, Faturamento
com UTMs — tudo descrito acima e presente no código deste repo).

Rebrand pra Tanise Xavier de Zordi feito: paleta verde extraída de
`tanisexavierdezordi.com.br` (`app/globals.css`), logo real aplicado (favicon,
painel, login — ver seção "Identidade visual"), tema claro como padrão
(toggle pro escuro mantido), CORS/cookie de domínio raiz apontando pra
`*.tanisexavierdezordi.com.br`, referências de domínio em comentários/textos
ajustadas.

Repo Git inicializado, commit do rebrand feito e push pro remoto
`TaniseX/track.tanisexavierdezordi.com.br` concluído (branch `main`). As 18
migrations em `supabase/migrations/` já foram coladas e rodadas no SQL
editor do projeto Supabase (`vbziznklmhckrkvrqghr`) — schema aplicado. Primeiro
usuário admin já criado — painel acessível em `/login`.

Checkout real da cliente é **Kiwify**, não Guru — webhook adicionado em
paralelo (`app/api/webhook/kiwify/[token]/route.ts` + `lib/kiwify/*`, ver
seção própria acima), mas **não validado com payload real** ainda, e o link
de checkout na LP ainda é estático (sem `trck_user_id`/utms).

**Ainda pendente**:
- Gerar os tipos TypeScript do schema (ver seção Migrations) — só qualidade
  de vida de tipagem, não bloqueia nada (decisão do usuário: não fazer por
  enquanto).
- Credenciais de Meta Pixel/GA4/webhook token já cadastradas; falta confirmar
  o webhook Kiwify contra uma venda real e trocar o link de checkout da LP
  pra dinâmico (ver seção "Webhook de compra Kiwify").
- Não confirmado se `movimentosemdor.tanisexavierdezordi.com.br` usa popup de
  lead (recipe `trckCheckoutUrl`/`trackEvent("Lead")`) além do botão de
  checkout — `InitiateCheckout` já foi corrigido (onClick no botão), `Lead`
  ainda não confirmado.
