# Kineo — PUSH #29

**Nome:** Share Delivery — Finished Videos into Organic Visits
**Status:** VALIDADO LOCALMENTE — aguardando commit, Vercel READY e validação em produção
**Data:** 16/07/2026

## Evidência que escolheu este push

- O placar recorrente externo continua em **0/10**; as duas assinaturas ativas no Stripe são internas.
- A aquisição externa caiu de 279 cadastros nos sete dias anteriores para 38 nos sete dias mais recentes: **-86,4%**.
- A ativação nos dias de maior volume permaneceu entre 37% e 46%; o colapso ocorreu no volume de aquisição, não no login ou no render.
- O pico começou quando a listagem da TAAFT entrou no ar em 03/07 e caiu junto com a perda de inventário/posição. O objetivo atual proíbe mídia paga, portanto não haverá recarga de PPC.
- Em 14 dias, 120 criadores externos concluíram 159 vídeos.
- Antes deste release, o novo loop teve um único clique externo: um novo usuário da Índia terminou um vídeo, abriu a folha nativa de compartilhamento e cancelou dois segundos depois.
- Resultado do loop no baseline: **0 links entregues, 0 visitas públicas, 0 cliques no CTA público, 0 cadastros indicados e 0 assinantes indicados**.
- Os vídeos já carregam `usekineo.com` gravado e end card “Made with Kineo”; duplicar branding não resolveria o gargalo anterior à visita.

## Hipótese

O texto “Share your finished Short” abria uma folha nativa ambígua e não deixava claro que a ação compartilhava uma página pública, não o MP4. Uma entrega determinística por cópia, apresentada como “enviar para feedback”, deve elevar a passagem de prompt visto para link entregue. A mesma ação em `My Videos` torna o catálogo já existente um ativo de aquisição sem email ou mídia paga.

## Escopo

- Criar uma única função para montar links `/v/[id]` com referral e UTM versionada.
- Trocar a ação principal do resultado por “Copy your public watch page”.
- Manter compartilhamento nativo apenas como opção secundária “More”.
- Manter WhatsApp como canal explícito com texto de feedback, sem promessa de viralidade.
- Corrigir “Preview” para abrir a página pública rastreável, não o MP4 cru.
- Adicionar um spotlight de distribuição para o vídeo mais recente em `My Videos`:
  - copiar a página pública;
  - abrir WhatsApp;
  - pré-visualizar a página.
- Instrumentar `video_share_prompt_viewed` somente quando pelo menos 50% do CTA estiver visível.
- Versionar os eventos do experimento com `push29_share_delivery`.
- Impedir que o sink genérico grave eventos de `localhost` ou Vercel Preview no funil real.
- Mostrar no Admin · Funnel:
  - atores que viram o prompt;
  - atores que clicaram;
  - atores que copiaram o link ou abriram um canal;
  - prompt → clique;
  - clique → link entregue;
  - visitas e cliques públicos atribuídos ao PUSH 29.

## Invariantes

- Nenhum vídeo, email, push notification ou mensagem é enviado automaticamente.
- QA local e Preview não alteram métricas de produção.
- Nenhuma mídia paga é ativada.
- Announce, base fria, demais segmentos e Product Hunt continuam pausados.
- Os quatro follow-ups D+2 do Lote 1 continuam como rascunhos até o gate de 17/07.
- O vídeo continua privado por URL não enumerável; o usuário escolhe explicitamente copiar ou abrir um canal.
- Nenhuma recompensa nova, claim de views ou promessa de viralidade é criada.
- Oferta pública, preços, Stripe, créditos, limite gratuito e providers não mudam.
- Contas internas continuam excluídas do placar comercial.

## Baseline antes do deploy

| Janela | Vídeos concluídos | Criadores | Cliques em share | Links entregues | Visitas `/v/` | Cadastros indicados |
|---|---:|---:|---:|---:|---:|---:|
| 7 dias | 25 | 17 | 1 | 0 | 0 | 0 |
| 14 dias | 159 | 120 | 1 | 0 | 0 | 0 |

Eventos `push29_share_delivery` antes do deploy: todos em zero.

## Validação local concluída em 16/07/2026

- `git diff --check`: aprovado.
- TypeScript completo: 21 erros de baseline já conhecidos.
- Filtro focal: zero erros nos trechos e arquivos do PUSH 29.
- Build de produção: aprovado; 141 de 141 páginas geradas.
- Helper de URL: nove asserts aprovados, incluindo UTM completa, referral válido e rejeição de código inválido.
- Sink local: POST de QA retornou `ignored=true`, `stored=false`, `reason=non_production_qa`.
- Supabase após QA local: todos os eventos `push29_share_delivery` continuam em zero.
- Página pública real validada localmente em desktop e viewport móvel 390×844:
  - vídeo, título e oferta legíveis;
  - watermark `usekineo.com` visível no asset;
  - CTA “Make one like this” visível sem corte;
  - nenhuma métrica real contaminada.
- Nenhum job de vídeo, checkout, pagamento, email ou mensagem foi criado.

## Gate de validação

1. `git diff --check` sem erros.
2. TypeScript focal sem novos erros nos arquivos do PUSH 29.
3. Build completo de produção aprovado.
4. Validar que o mesmo link contém `/v/[id]`, `utm_source=kineo_user`, `utm_medium=video_share`, `utm_campaign=referral`, `utm_content=push29_share_delivery` e referral somente quando válido.
5. Validar que copiar/abrir WhatsApp exige clique explícito.
6. Confirmar que “Preview” abre a página pública e que o CTA “Make one like this” preserva o fluxo de cadastro.
7. Revisar staging exato; nunca usar `git add .`.
8. Publicar na `main`, aguardar Vercel READY e validar produção sem gerar job pago.
9. Confirmar baseline zero dos eventos versionados antes de medir usuários reais.

## Critério de decisão

Primeiro sinal útil: pelo menos um link entregue e uma visita pública externa. O PUSH não é considerado conversão até produzir cadastro indicado e, por fim, assinatura recorrente externa válida. A meta principal permanece **10 assinantes recorrentes em 14 dias sem mídia paga**.
