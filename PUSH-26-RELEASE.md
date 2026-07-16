# Kineo — PUSH #26

**Nome:** Acquisition Truth & Entry-Price Repair
**Status:** PUBLICADO E VALIDADO TECNICAMENTE EM PRODUÇÃO
**Data:** 16/07/2026
**Commit de código:** `cb25b15bf9a5640ee4523b05d579310458674e3a`
**Deploy Vercel:** `dpl_DGdRaSFwzKPFaoRehvm9BweGtNEk` — READY em `https://www.usekineo.com`

## Evidência que escolheu este push

- A queda de aquisição é real: entre 04–06/07 entraram 184 usuários externos, 75 ativaram e 4 chegaram à intenção de checkout; entre 12–16/07 entraram 16, apenas 4 ativaram e nenhum chegou ao checkout.
- Nos últimos 30 dias há 320 cadastros externos no recorte atual:
  - `direct`: 239 cadastros / 97 ativados;
  - `taaft`: 58 / 17;
  - `topai.tools`: 11 / 2;
  - `chatgpt`: 5 / 1;
  - `google`: 4 / 3;
  - `gmail`: 2 / 1;
  - `uneed.best`: 1 / 0.
- O TAAFT continua enviando usuários, inclusive em 16/07, mas o pico inicial já perdeu volume.
- Doze perfis tinham `accounts.google.com` como referrer de cadastro. Isso é o retorno do OAuth, não a origem que adquiriu a pessoa.
- Um perfil tinha `checkout.stripe.com` como referrer de cadastro. Isso é retorno do pagamento, não aquisição.
- O painel agrupava esses 13 registros como fontes externas reais e separava variantes do mesmo canal, como `google.com` e o app de busca do Google.
- A seção chamada “Organic recovery” contava apenas campanhas `push22_*`, mas não deixava claro que Google, TAAFT e outros diretórios estavam fora daquele número.
- A página pública de preços ainda dizia “from $9.90/mo”; a barra fixa ainda mostrava Starter `$9.90` e Creator `$24.90`, apesar da oferta vigente ser `$4.90` e `$9.90` no primeiro mês.
- O metadata de `/pricing` e `public/llms.txt` ainda repetiam a oferta antiga/incompleta, aumentando a chance de snippets e respostas de busca desatualizados.

## Escopo

- Criar uma política única de fonte de aquisição usada no browser, API e painel.
- Nunca aceitar como aquisição:
  - domínios próprios da Kineo/ShortsForgeAI;
  - `accounts.google.com`;
  - `checkout.stripe.com`;
  - hosts de autenticação `*.supabase.co`.
- Normalizar canais equivalentes:
  - TAAFT e subdomínios → `taaft`;
  - Google web/app → `google`;
  - app Gmail → `gmail`;
  - ChatGPT → `chatgpt`.
- Sanitizar novamente na API; o cliente não pode gravar um referrer de infraestrutura mesmo enviando o valor diretamente.
- Não alterar registros históricos. O Admin · Funnel corrige os 13 self-referrals apenas na leitura.
- Adicionar ao painel:
  - cadastros com fonte conhecida;
  - ativados e pagos com fonte conhecida;
  - direto/desconhecido;
  - self-referrals corrigidos;
  - principal fonte conhecida.
- Renomear a seção do PUSH #22 para deixar explícito que ela mede somente as landing pages/campanhas daquele push.
- Alinhar oferta pública:
  - metadata de `/pricing`;
  - hero da página de preços;
  - barra fixa mobile;
  - comparação da homepage;
  - CTAs de duas landing pages orgânicas;
  - `public/llms.txt`.

## Oferta pública após o push

- Free: criar, assistir, baixar e compartilhar até 3 vídeos Fast com marca d’água a cada 24 horas, sem cartão.
- Starter: US$4.90 no primeiro mês; US$9.90/mês depois.
- Creator: US$9.90 no primeiro mês; US$24.90/mês depois.
- Studio: US$37.90/mês.
- Sem timer, escassez, prova social ou claim inventado.

## Invariantes

- Primeiro toque válido continua vencendo; reload e retorno futuro não sobrescrevem uma fonte confiável.
- OAuth, checkout e navegação interna nunca viram aquisição.
- TAAFT e Google legítimos continuam sendo medidos.
- Nenhum perfil ou evento histórico é apagado ou regravado.
- Nenhum email é enviado.
- Nenhum render pago/provider é disparado.
- Lote 1, announce, base fria e Product Hunt permanecem nos gates atuais.
- Contas internas continuam excluídas do placar.

## Validação local concluída

- Matriz unitária manual da política de atribuição: 12/12 casos aprovados.
- Casos aprovados incluem TAAFT, Google web/app, Gmail, TopAI, domínio próprio, Google OAuth e Stripe Checkout.
- Releitura de 30 dias com a nova regra:
  - 81 cadastros com fonte conhecida;
  - 239 direto/desconhecido;
  - 13 self-referrals históricos corrigidos na leitura;
  - TAAFT é a maior fonte conhecida, com 58 cadastros.
- `npm.cmd run build`: aprovado; 141 de 141 páginas geradas.
- TypeScript completo: 21 erros de baseline e zero erro nos arquivos do PUSH #26.
- `git diff --check`: aprovado.

## Validação em produção concluída

- Commit enviado para `main`; `HEAD` local e `origin/main` apontam para `cb25b15` antes deste registro documental.
- Deployment `dpl_DGdRaSFwzKPFaoRehvm9BweGtNEk` confirmado como `READY` e associado a `www.usekineo.com`.
- Homepage e `/pricing` respondem HTTP 200.
- Title de `/pricing`: `Kineo Pricing — Starter $4.90 First Month`.
- Description publica a oferta completa: até 3 Fast com marca d’água a cada 24h, Starter US$4.90 no primeiro mês e US$9.90/mês depois.
- Hero novo `$4.90` presente; hero antigo `from $9.90/mo` ausente.
- Comparação da homepage mostra `$4.90 first month`.
- `/api/admin/funnel` sem sessão continua protegido e responde HTTP 403.
- A releitura da base com a mesma função publicada confirmou 13 self-referrals históricos corrigidos na leitura.
- Nenhum cadastro, evento, checkout, pagamento, email ou render artificial foi criado pela validação.

## Microteste após deploy

Durante os próximos 7 dias:

- separar cadastros por `taaft`, `google`, `topai.tools`, `chatgpt`, `gmail` e `direct`;
- nenhuma nova linha deve ser atribuída a `accounts.google.com` ou `checkout.stripe.com`;
- medir signup → primeiro vídeo → oferta pós-vídeo → checkout → assinatura por fonte;
- manter a meta do PUSH #25 nos próximos 10 primeiros vídeos concluídos;
- não ampliar campanha antes do gate de 48 horas do Lote 1.

## Meta vinculada

Chegar a pelo menos 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga. Placar no início deste push: **0/10**.
