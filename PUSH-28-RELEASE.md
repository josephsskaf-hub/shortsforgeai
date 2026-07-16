# Kineo — PUSH #28

**Nome:** Repeat-Creator Upgrade Moment
**Status:** PUBLICADO E VALIDADO EM PRODUÇÃO
**Data:** 16/07/2026
**Commit de código:** `12c387f2910eb5ae23cfb66f6283e1d96fcab214`
**Deploy Vercel:** `dpl_8Jg91LAegbWK4n3j7oo4Yf3Yreag` — READY

## Evidência que escolheu este push

- O placar recorrente externo continua em **0/10**; as duas assinaturas ativas ou em trial no Stripe são internas.
- Existem 194 usuários externos gratuitos com pelo menos um vídeo concluído.
- Trinta e dois desses usuários já concluíram dois ou mais vídeos.
- Doze já concluíram três ou mais; cinco concluíram cinco ou mais.
- Quatro criadores gratuitos com dois ou mais vídeos tiveram atividade nos últimos sete dias.
- A página `My Videos` já mostrava uma oferta de Starter dentro do player, mas o bloco mais visível no topo continuava priorizando outro render para todos os usuários.
- Uma conta com dois ou mais vídeos já provou valor repetido. Para esse grupo, continuar escondendo a oferta dentro do player desperdiça o momento de maior intenção que ainda pode ser alcançado sem email ou mídia paga.
- A auditoria das tentativas recentes de checkout não reproduziu falha técnica: tentativas anônimas foram corretamente encaminhadas para autenticação e checkouts autenticados criaram sessões Stripe.

## Escopo

- Preservar “Build Next Episode” como ação principal para quem concluiu apenas um vídeo.
- Para conta gratuita com dois ou mais vídeos concluídos:
  - mostrar no topo de `My Videos` uma oferta recorrente de Starter;
  - declarar `Start for $4.90 today, then $9.90/month`;
  - declarar 25 créditos Fast por mês;
  - declarar cancelamento a qualquer momento;
  - explicar que a assinatura limpa **novos** exports, sem prometer remoção retroativa da marca d’água dos arquivos existentes;
  - manter “Keep testing with watermark” como alternativa visível.
- Não mostrar esse bloco de monetização para assinantes válidos.
- Não alterar preço, Stripe, créditos, limite gratuito, providers ou pipeline de geração.

## Instrumentação

Eventos com `version=push28_repeat_creator`:

- `history_repeat_offer_viewed`;
- `history_repeat_offer_clicked`.

O painel Admin · Funnel passa a mostrar atores únicos em:

- oferta vista;
- clique no Starter;
- sessão Stripe criada depois do clique;
- assinatura ativa/trialing confirmada no Stripe;
- view → click;
- click → checkout;
- checkout → active.

O checkout é atribuído pelo mesmo usuário autenticado ou pela sessão de navegador. Um checkout genérico iniciado em outro ponto não entra no microteste.

## Invariantes

- Oferta pública preservada: Starter por $4.90 no primeiro mês e $9.90/mês depois.
- Free preservado: até 3 vídeos Fast com marca d’água por 24 horas, sem cartão.
- Nenhum arquivo existente é descrito como retroativamente watermark-free.
- Nada é cobrado sem clique explícito.
- Nenhum email, push notification ou mensagem é enviado.
- Os quatro follow-ups D+2 do Lote 1 permanecem como rascunhos; nenhum foi enviado neste push.
- Announce, base fria, demais segmentos e Product Hunt continuam pausados.
- Contas internas continuam excluídas do placar.

## Validação local concluída em 16/07/2026

- `git diff --check`: aprovado.
- Build de produção: aprovado; 141 de 141 páginas geradas.
- `/history` compilou com bundle final de 8.03 kB; Admin · Funnel compilou com 6.82 kB.
- TypeScript completo manteve 21 erros de baseline já conhecidos.
- Filtro focal confirmou zero erros nos três arquivos alterados do PUSH #28.
- Baseline pré-deploy confirmado em zero para `history_repeat_offer_viewed` e `history_repeat_offer_clicked` com `version=push28_repeat_creator`.
- Nenhuma conta elegível foi aberta e nenhum evento, checkout, pagamento, email ou render artificial foi criado.
- O commit deve incluir somente:
  - `app/(dashboard)/history/HistoryClient.tsx`;
  - `app/api/admin/funnel/route.ts`;
  - `app/(dashboard)/admin/funnel/FunnelClient.tsx`;
  - `PUSH-28-RELEASE.md`.

## Validação em produção concluída em 16/07/2026

- Commit `12c387f` confirmado em `origin/main`.
- Deploy `dpl_8Jg91LAegbWK4n3j7oo4Yf3Yreag` confirmado como `READY`.
- `www.usekineo.com`, `usekineo.com`, `shortsforgeai.com` e aliases Vercel apontam para o mesmo deploy.
- Homepage confirmou HTTP 200.
- `/history` sem sessão confirmou HTTP 307 para `/login`.
- `/api/admin/funnel` sem sessão confirmou HTTP 403.
- `My Videos` não foi aberto com conta elegível durante a validação.
- Baseline pós-deploy confirmado em zero para `history_repeat_offer_viewed` e `history_repeat_offer_clicked` com `version=push28_repeat_creator`.
- O baseline deve crescer somente com criadores externos reais que tenham dois ou mais vídeos concluídos.

## Meta do microteste

Nos próximos 10 criadores gratuitos recorrentes que visualizarem a oferta:

- pelo menos 3 devem clicar no Starter;
- pelo menos 2 devem chegar a uma sessão Stripe;
- pelo menos 1 deve se tornar assinante externo ativo ou trialing.

Se view → click falhar, revisar promessa/copy. Se click → checkout falhar, auditar autenticação e criação de sessão. Se checkout → active falhar, auditar preço, pagamento e confiança no Stripe. Não ampliar campanhas externas com base apenas em impressão.

## Meta vinculada

Chegar a pelo menos 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga. Placar no início deste push: **0/10**.
