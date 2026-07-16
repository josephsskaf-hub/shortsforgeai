# Kineo — PUSH #24

**Nome:** Retention + Recurring Shows
**Status:** PUBLICADO E VALIDADO TECNICAMENTE EM PRODUÇÃO
**Data:** 16/07/2026
**Commit de código:** `2b049a9e21ae8eff87fd42aea18df7e981d48913`
**Deploy Vercel:** `dpl_2oYydvQifp4TTvqgKpuN2GBfkegN` — READY em `https://www.usekineo.com`

## Diagnóstico comprovado

- Nos 14 dias anteriores à auditoria, 158 vídeos externos foram concluídos por 119 criadores externos.
- 100 criadores concluíram exatamente um vídeo e pararam.
- Apenas 19 criadores fizeram dois ou mais vídeos: taxa de segundo vídeo de **16,0%**.
- Treze repetiram no mesmo dia; apenas seis voltaram em outro dia dentro de sete dias: retorno real de **5,0%**.
- O histórico tinha uma CTA de episódio 2 apenas quando a conta possuía exatamente um vídeo.
- Depois do segundo vídeo, a CTA desaparecia; a tela de conclusão e a lista recente do gerador também não ofereciam continuação de série.
- O painel Admin · Funnel não separava one-and-done, segundo vídeo, retorno em outro dia ou o funil de continuação.

## Escopo do PUSH #24

- Criar um construtor único de continuação de série com:
  - tópico e formato reconhecíveis;
  - hook, fatos e payoff novos;
  - proibição explícita de repetir o episódio anterior;
  - origem da CTA preservada na URL.
- Adicionar `Build the next episode` na tela de vídeo concluído.
- Preservar as configurações atuais da sessão ao continuar diretamente da tela concluída.
- Mostrar `Continue your show` para usuários recorrentes na página principal de geração.
- Manter a CTA de continuação no topo de My Videos para qualquer quantidade de vídeos.
- Adicionar `Next episode` em cada card da biblioteca.
- Medir:
  - `series_continue_clicked`;
  - `series_continuation_landed`;
  - renders iniciados com `series_continuation=true`;
  - renders concluídos com `series_continuation=true`.
- Adicionar ao Admin · Funnel:
  - criadores concluídos;
  - one-and-done;
  - criadores recorrentes;
  - creator → segundo vídeo;
  - repetição em sete dias;
  - retorno em outro dia;
  - clique → render;
  - render → conclusão.

## Invariantes comerciais e de segurança

- A continuação prepara um brief; não inicia render nem consome créditos sem ação explícita do usuário.
- Fast continua com até 3 vídeos com marca d'água por 24 horas, sem cartão.
- Nenhuma oferta, preço, entitlement ou regra de cobrança é alterada.
- Nenhum email é enviado e Lote 1, announce, base fria e Product Hunt permanecem nos gates existentes.
- Contas internas continuam excluídas de todas as métricas.

## Meta do microteste

Nos próximos 10 criadores externos que concluírem um vídeo após o deploy:

- pelo menos 4 cliques em continuação;
- pelo menos 3 renders de continuação iniciados;
- pelo menos 2 continuações concluídas;
- elevar creator → segundo vídeo de 16,0% para pelo menos 30% no microcoorte;
- observar retorno em outro dia separadamente, sem antecipar resultado de sete dias.

Se houver clique sem render, revisar brief e transição para opções. Se houver render sem conclusão, atacar estabilidade. Se não houver clique, testar posição/copy. Assinatura recorrente externa continua sendo a métrica final; retenção só é sucesso comercial quando aumenta exposição ao upgrade e assinaturas verificadas no Stripe.

## Validação executada

- `npm.cmd run build`: aprovado, 141 de 141 páginas geradas.
- `npx.cmd tsc --noEmit --pretty false`: nenhuma regressão nova; permanecem somente os 22 erros de baseline já conhecidos.
- `git diff --check`: aprovado.
- Commit de código publicado em `main` e Vercel confirmado como READY com o mesmo SHA.
- `/generate` em sessão anônima redireciona para `/login?redirect=%2Fgenerate`, preservando o retorno após login.
- `/api/admin/funnel` sem sessão retorna 403, confirmando o gate administrativo.
- Nenhum erro de console foi observado no fluxo público de login.
- A sessão disponível no navegador não estava autenticada. Por isso, a interface protegida de retenção não foi clicada em produção e nenhum evento artificial foi criado; a validação dessas telas ficou coberta pelo build de produção e pela revisão dos links e metadados no código.

## Placar no fechamento técnico

- Assinantes recorrentes externos verificados no Stripe: **0/10**.
- Assinaturas ativas/trialing encontradas: 2, ambas internas e excluídas do placar.
- Respostas dos quatro compradores do Lote 1: **0**.
- Checkouts externos após o deploy anterior: **0**.
- Nenhum email novo foi enviado e nenhum render pago de teste foi iniciado.

## Meta vinculada

Chegar a pelo menos 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga. Placar no início deste release: **0/10**.
