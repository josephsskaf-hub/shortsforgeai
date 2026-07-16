# Kineo — PUSH #25

**Nome:** Post-Video Export Conversion
**Status:** VALIDADO LOCALMENTE — aguardando commit, deploy READY e validação ao vivo
**Data:** 16/07/2026

## Evidência que escolheu este push

- Depois do PUSH #22 entrou um novo usuário externo por busca do Google.
- O fluxo técnico funcionou: OAuth concluído, chegada ao gerador, análise, render Fast iniciado e vídeo concluído.
- O vídeo foi concluído cerca de quatro minutos após o cadastro.
- O usuário baixou o MP4 com marca d'água, abriu a ação de compartilhamento e cancelou o share.
- Depois voltou ao gerador, mas não iniciou outro vídeo.
- Não houve `pricing_view`, checkout Stripe iniciado nem pagamento.
- Stripe continua com zero assinantes recorrentes externos válidos; as duas assinaturas `active/trialing` são internas.

O gargalo observado deixou de ser cadastro ou primeiro render. Ele está entre o vídeo pronto e a intenção paga.

## Problema de interface comprovado

- A oferta de exportação limpa era azul.
- Logo abaixo dela havia um botão verde, maior e descrito como ação principal, para baixar gratuitamente com marca d'água.
- O usuário real seguiu a ação gratuita visualmente dominante.
- O painel não distinguia oferta elegível de oferta realmente vista no viewport.
- Pagamentos não carregavam a origem `post_video_clean_export` até o evento canônico do webhook.

## Escopo

- Unificar a decisão de exportação em um único card logo após o player.
- Mostrar primeiro a opção paga e concreta:
  - reconstruir este mesmo vídeo sem marca d'água;
  - Starter por US$4.90 hoje;
  - 25 créditos incluídos;
  - renovação por US$9.90/mês em 30 dias;
  - cancelamento a qualquer momento.
- Manter a alternativa gratuita claramente disponível no mesmo card: MP4 com marca d'água.
- Retirar o segundo botão verde concorrente somente quando o card de escolha está disponível.
- Depois de um download gratuito confirmado, atualizar a copy sem esconder nem bloquear a opção gratuita.
- Registrar `post_video_offer_viewed` apenas quando pelo menos 50% do card estiver realmente visível.
- Registrar `post_video_clean_export_clicked` antes da navegação.
- Preservar no checkout, na assinatura e no webhook a origem `post_video_clean_export`.
- Atualizar a assinatura de idempotência do Stripe para incluir a nova origem e evitar conflito com sessões criadas antes deste push.
- Adicionar ao Admin · Funnel:
  - ofertas realmente vistas;
  - downloads com marca d'água;
  - cliques em exportação limpa;
  - checkouts pós-vídeo;
  - pagamentos pós-vídeo;
  - view → click, click → checkout e checkout → paid.

## Invariantes

- O download gratuito com marca d'água continua disponível e não exige cartão.
- Não existe timer, escassez, claim ou prova social fabricada.
- Preço inicial, renovação e cancelamento aparecem antes do clique.
- A oferta continua sendo assinatura recorrente Starter; pack avulso não volta à superfície pública.
- Nenhum pagamento, render de provider ou email é criado pela validação.
- Lote 1, announce, base fria e Product Hunt permanecem nos gates atuais.
- Contas internas continuam excluídas do placar.

## Validação local concluída

- `npm.cmd run build`: aprovado, 141 de 141 páginas geradas.
- TypeScript completo: nenhuma regressão nova; permanecem somente os 22 erros de baseline já conhecidos.
- `git diff --check`: aprovado.
- O card contém as duas escolhas de exportação; o download gratuito não foi removido.
- A ação de download verde concorrente deixa de aparecer somente quando o card unificado já fornece o mesmo download gratuito.
- A impressão da oferta depende de `IntersectionObserver` com 50% de visibilidade.
- O clique limpo preserva `tier=starter`, `intro=1` e `return=wm`.
- `checkout_origin=post_video_clean_export` atravessa Checkout Session, Subscription e `payment_success` do webhook.
- A chave de idempotência foi versionada e inclui a origem do checkout.
- Nenhum checkout, pagamento, email ou render de provider foi criado durante a validação.

## Meta do microteste

Nos próximos 10 usuários externos que concluírem um primeiro Fast gratuito:

- pelo menos 8 devem realmente visualizar o card de exportação;
- pelo menos 3 devem clicar em `Download clean + Start Starter`;
- pelo menos 2 devem chegar a uma sessão Stripe criada;
- pelo menos 1 deve concluir uma assinatura recorrente válida;
- zero usuário deve perder a opção de download gratuito com marca d'água.

Se houver conclusão de vídeo sem view, reduzir altura/posição do player. Se houver view sem clique, revisar a proposta. Se houver clique sem checkout, revisar a transição/autenticação. Se houver checkout sem pagamento, revisar preço, confiança e métodos de pagamento sem inventar urgência.

## Meta vinculada

Chegar a pelo menos 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga. Placar no início deste push: **0/10**.
