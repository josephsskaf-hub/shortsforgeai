# Kineo — PUSH #23

**Nome:** Creator Loop + Referral Distribution
**Status:** PUBLICADO E VALIDADO EM PRODUÇÃO
**Data:** 16/07/2026

## Diagnóstico comprovado

- Nos 14 dias anteriores à auditoria houve 316 cadastros externos, 158 vídeos concluídos e 119 criadores externos com pelo menos um vídeo concluído.
- O banco não tinha nenhum `video_share_clicked`, `video_shared`, acesso rastreado a `/v/[id]`, cadastro indicado ou recompensa de referral qualificada.
- A medição de compartilhamento no momento de conclusão só entrou em produção no fim de 15/07, depois dos últimos vídeos externos concluídos. Portanto, o zero histórico prova ausência de distribuição mensurável, mas ainda não prova rejeição do botão atual.
- A tela concluída diluía a ação pública entre Preview, URL crua do MP4, WhatsApp, More, X e outro botão de share.
- WhatsApp, X, “More” e “Copy link” podiam distribuir o MP4 cru, sem página pública, CTA, UTM ou referral.
- O ID público dependia de uma leitura RLS best-effort depois do insert; uma falha silenciosa escondia completamente o botão público.
- A página `/v/[id]` tinha CTA de cadastro atribuída por UTM, mas nenhum evento específico para medir visita → intenção.
- O painel Admin · Funnel não mostrava o creator loop.

## Escopo do PUSH #23

- O status do render retorna o `video_id` persistido diretamente e usa lookup server-side por `user_id + render_id` como fallback.
- Duplicatas idempotentes também recuperam o ID existente.
- A tela de vídeo concluído ganha uma ação principal de compartilhamento logo após o download.
- Cópia, WhatsApp, X e share nativo usam sempre `/v/[id]` com:
  - `utm_source=kineo_user`;
  - `utm_medium=video_share`;
  - `utm_campaign=referral`;
  - código `ref` individual quando disponível.
- O MP4 cru continua disponível apenas para preview/download; ele deixa de ser o link de aquisição.
- “My Videos” passa a copiar a mesma URL pública atribuída e inclui referral quando disponível.
- Eventos separados medem intenção e resultado:
  - `video_share_clicked`;
  - `video_shared`;
  - `video_share_channel_opened`;
  - `video_share_manual_copy_shown`;
  - `public_video_cta_clicked`.
- A CTA “Make one like this” da página pública passa a registrar intenção antes de navegar para signup.
- Admin · Funnel passa a mostrar:
  - criadores/vídeos concluídos;
  - cliques e shares concluídos;
  - creator → share;
  - visitas a vídeos públicos;
  - cliques na CTA pública;
  - landing → CTA;
  - cadastros indicados e rewards qualificados;
  - CTA → signup;
  - assinantes indicados verificados no Stripe;
  - signup indicado → pago.
- Páginas orgânicas, mensagens transacionais e materiais locais deixam de usar a oferta antiga “primeiro Short grátis” ou “3 dias de trial”.
- Termos passam a refletir cobrança imediata do preço introdutório e renovação mostrada no checkout.

## Oferta canônica preservada

- Até 3 vídeos Fast com marca d'água a cada 24 horas, sem cartão.
- Starter: US$4.90 no primeiro mês e US$9.90/mês depois.
- Creator: US$9.90 no primeiro mês e US$24.90/mês depois.
- Studio: US$37.90/mês.
- Assinaturas pagas têm garantia de reembolso de sete dias; não existe trial genérico de três dias.

## Validação local concluída em 16/07/2026

- `git diff --check` limpo.
- TypeScript focal: nenhum erro novo nos arquivos do PUSH #23; permanecem os 22 erros baseline já conhecidos fora deste release.
- Build de produção concluído: 141/141 páginas.
- Página pública real validada localmente com vídeo disponível, copy atual e CTA para signup.
- Desktop: player, proposta e CTA visíveis, sem overflow horizontal.
- Mobile 390 × 844: `scrollWidth=390`, player e CTA presentes, sem overflow horizontal.
- O único evento anônimo criado pelo QA local foi identificado por `utm_source=qa` e removido; o placar de produção não ficou contaminado.
- Nenhum vídeo de provider foi gerado e nenhum email foi enviado.

## Publicação e validação em produção

- Commit de código e release: `044d4ad` (`PUSH #23 turn completed videos into measurable referrals`).
- Push concluído em `main` sem `git add .`; nenhum arquivo privado do Lote 1, CSV, `.bat` ou material antigo entrou no commit.
- Vercel deployment `dpl_4Kk31zuPenrRGkb27DeaWiDrkFS5`: READY e associado a `www.usekineo.com`.
- `/v/[id]` com vídeo real, `/facts`, `/faceless-channel-ideas`, `/ai-shorts-without-filming`, `/cheapest-ai-shorts-maker`, `/alternatives/opusclip` e `/terms`: HTTP 200 em produção.
- Página pública real contém o player, a oferta de até 3 Fast videos com marca d'água a cada 24 horas e a CTA `Make one like this`.
- As páginas verificadas não contêm `first Short free`, `first one free`, `3-day trial`, `$11.90` nem `50 more Shorts`.
- Termos publicados confirmam cobrança imediata do preço introdutório, data/preço da primeira renovação antes do pagamento e garantia de sete dias.
- `/api/admin/funnel` mantém o gate de segurança: sem sessão admin responde `403 Forbidden`. O contrato `creatorLoop` passou no build do mesmo commit; o payload autenticado deve ser observado na próxima sessão admin real, sem fabricar autenticação ou eventos.
- Nenhum evento de share/CTA foi fabricado durante a validação. Logo após o deploy havia zero eventos reais novos no creator loop.
- Stripe continua com 2 assinaturas `active/trialing`, ambas internas pela classificação canônica; assinaturas recorrentes externas válidas: **0/10**.

## Meta do microteste

Nos próximos 10 criadores externos que concluírem um vídeo após o deploy:

- pelo menos 3 devem clicar em compartilhar;
- pelo menos 2 devem concluir share nativo ou copiar a URL pública;
- o loop deve gerar pelo menos 2 visitas públicas;
- pelo menos 1 visitante deve clicar em “Make one like this”;
- qualquer cadastro, vídeo ou assinatura indicada deve ser verificado no painel e no Stripe.

Se houver vídeos concluídos e zero share, a próxima ação é testar nova copy/incentivo na ação de compartilhamento. Se houver shares e zero visitas, revisar canal/preview. Se houver visitas e zero CTA, revisar a página pública. Não escalar referral sem identificar a etapa que converte.

## Gates comerciais preservados

- Lote 1 continua isolado; nenhum follow-up é enviado antes da revisão D+2.
- Announce e base fria continuam pausados.
- Product Hunt continua em rascunho.
- Nenhuma mídia paga.

## Meta vinculada

Chegar a pelo menos 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga. O PUSH #23 cria distribuição mensurável a partir do valor já produzido, mas não encerra a meta sem assinaturas externas confirmadas no Stripe.
