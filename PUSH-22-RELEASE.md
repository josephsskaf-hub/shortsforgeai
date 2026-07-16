# Kineo — PUSH #22

**Nome:** Organic Acquisition Recovery
**Status:** PUBLICADO — Vercel READY e produção validada
**Data:** 16/07/2026

## Diagnóstico comprovado

- A queda principal aconteceu antes da ativação: signups externos caíram de 69 em 04/07 para 1 em 15/07 e 1 em 16/07.
- O sitemap de produção responde 200 e contém 60 URLs válidas.
- A busca pública encontra principalmente a homepage e uma parcela mínima do cluster orgânico.
- A homepage quase não criava links internos para as páginas de alta intenção, reduzindo descoberta e autoridade interna.
- Várias páginas orgânicas ainda prometiam “first Short free” e “from $9.90/mo”, em desacordo com a oferta atual.
- CTAs de páginas orgânicas não compartilhavam uma medição única antes do cadastro.
- O sitemap declarava `lastModified` como o horário de cada requisição para todas as páginas, mesmo sem mudança real.

## Escopo do PUSH #22

- Homepage passa a distribuir links para páginas de produto, ferramentas, nichos e comparativos.
- Footer público ganha hubs e links de alta intenção.
- Novo hub `/free-ai-shorts` liga as 14 páginas de nicho em uma estrutura rastreável.
- Sitemap inclui o novo hub e usa uma data de modificação estável e honesta.
- Title global passa a mostrar a entrada real: Starter por $4.90 no primeiro mês.
- Páginas de tópico, preço, faceless, sem filmagem, nichos e alternativas usam a oferta atual:
  - até 3 vídeos Fast com marca d'água a cada 24h, sem cartão;
  - Starter por $4.90 no primeiro mês;
  - renovação por $9.90/mês depois.
- CTAs orgânicos preservam prompt e atribuição com campanhas `push22_*`.
- Novo evento `organic_cta_clicked` mede intenção antes do signup.
- Painel Admin Funnel mostra:
  - sessões nas páginas orgânicas;
  - cliques nos CTAs;
  - landing → CTA;
  - signups atribuídos;
  - CTA → signup;
  - signup → primeiro vídeo;
  - assinantes recorrentes verificados;
  - ranking das páginas de entrada.

## Gate de publicação

1. TypeScript focal sem novos erros.
2. Build completo de produção.
3. `git diff --check` limpo.
4. Confirmar 61 URLs válidas no sitemap local.
5. Confirmar canonical, title, oferta e links internos nas páginas principais.
6. Confirmar que o evento genérico não permite forjar eventos autoritativos do PUSH #21.
7. Revisar somente os arquivos do PUSH #22 no stage; nunca usar `git add .`.
8. Commitar e enviar para `main`.
9. Aguardar Vercel READY.
10. Validar produção por HTTP sem clicar em CTA nem criar eventos internos no placar.

## Validação local concluída em 16/07/2026

- TypeScript focal: zero erros novos; permanecem somente os 22 erros baseline já conhecidos.
- Build de produção: 141/141 páginas geradas.
- Sitemap local: 61/61 URLs respondem 200.
- Homepage contém links diretos para os cinco hubs/páginas prioritários.
- Nove superfícies auditadas entregam oferta atual, campanha `push22_*`, footer e nenhum claim antigo no HTML renderizado.
- Layout do novo hub validado em desktop e em 390 × 844 sem overflow horizontal.
- Colunas de atribuição em `profiles` e de caminho/sessão em `events` confirmadas no banco.
- `git diff --check` limpo.

## Publicação validada em 16/07/2026

- Commit de código: `b6a1027` — `PUSH #22 recover measurable organic acquisition`.
- Deployment: `dpl_4Dijtsw6oVFdVPjs1jhnmvCGbjA8`.
- Estado Vercel: READY, ambiente Production.
- `https://www.usekineo.com/sitemap.xml`: 61 URLs, todas respondendo 200.
- Homepage em produção: título de entrada por $4.90 e links para os hubs prioritários.
- Hub `/free-ai-shorts`, página de nicho, página de tópico e comparação OpusClip:
  canonical correto, oferta atual, campanha `push22_*`, footer interno e zero claim antigo no HTML entregue.

## Gate comercial

- Não publicar Product Hunt neste push.
- Não tocar announce nem base fria.
- Não ampliar o Lote 1 antes do resultado do microteste.
- Escalar páginas/canais somente quando houver sessão → CTA → signup → vídeo mensurável.

## Meta vinculada

Chegar a pelo menos 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga. PUSH #22 recupera aquisição mensurável; não encerra a meta sem assinaturas verificadas no Stripe.
