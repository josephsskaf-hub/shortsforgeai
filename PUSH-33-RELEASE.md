# PUSH #33 — Partner attribution reliability

**Data:** 16/07/2026

**Status:** publicado e validado em produção

**Meta comercial ativa:** 10 assinantes recorrentes externos válidos em 14 dias, sem mídia paga
**Placar antes deste PUSH:** 0/10

## Diagnóstico confirmado

Auditoria ao vivo antes da mudança:

- 665 perfis externos.
- 470 códigos de indicação emitidos.
- 1 clique de compartilhamento de vídeo registrado.
- 0 usuários indicados e 0 recompensas qualificadas.
- 0 afiliados externos, 0 cliques, 0 cadastros atribuídos e 0 comissões.

O motor existia, mas ainda não havia gerado aquisição. A inspeção encontrou riscos que poderiam perder a primeira atribuição em falhas transitórias, corrida entre requisições ou criação tardia do perfil.

## Escopo

- Preserva o código de indicação até o servidor confirmar a atribuição.
- Valida e normaliza códigos de indicação antes de armazenar ou consultar.
- Remove valores locais inválidos que bloqueavam uma nova captura válida.
- Impede que requisições concorrentes sobrescrevam a primeira indicação.
- Faz reconciliação da atribuição de afiliado quando a linha de referral existe, mas o perfil ainda não foi marcado.
- Mantém retry para falhas transitórias de autenticação, perfil ou banco.
- Exige afiliado ativo e impede autoindicação.
- Corrige o estado de login da área `/affiliate` e preserva o retorno após cadastro/login.
- Faz `/partners` levar ao fluxo self-service rastreável do programa.
- Remove claims públicos não garantidos e atualiza a matemática para os preços atuais.

## Fora do escopo

- Nenhum e-mail, DM ou campanha enviado.
- Nenhum segmento adicional tocado.
- Nenhuma recompensa, comissão ou afiliado criado artificialmente.
- Nenhuma mudança no lote 1 ou nos quatro códigos `KINEO5-*`.

## Validação local

- `npm.cmd run build`: aprovado, 146/146 páginas estáticas.
- TypeScript: nenhum erro novo nos arquivos do PUSH; permanecem somente os 20 erros preexistentes já catalogados.
- `git diff --check`: aprovado.
- `/partners`: HTTP 200, CTA e campanha `push33_partner_program` presentes.
- Condições públicas: 90 dias, preços atuais, exemplos com ressalvas e FAQ estruturado.
- Claims antigos removidos: “forever”, conta premium garantida e vídeo em 60 segundos.
- `/api/referral/attribute` sem login: HTTP 401, nenhuma gravação.
- `/api/affiliate/attribute` sem cookie: resposta `no_cookie`, nenhuma gravação.

## Arquivos do release

- `lib/referral.ts`
- `components/ReferralAutoTrigger.tsx`
- `components/AffiliateAutoTrigger.tsx`
- `app/api/referral/attribute/route.ts`
- `app/api/affiliate/attribute/route.ts`
- `app/(dashboard)/affiliate/page.tsx`
- `app/partners/page.tsx`

## Publicação

- Commit de código: `f966a7d` (`PUSH #33 make partner attribution reliable`).
- Deploy Vercel: `dpl_3zGCQAQC5Mtn5hyMkNUrJG6P4KyP` — `READY`.
- Domínios confirmados: `www.usekineo.com`, `usekineo.com`, `shortsforgeai.vercel.app`, `shortsforgeai.com` e `www.shortsforgeai.com`.
- `/partners`: HTTP 200 no domínio público, campanha, CTA, 90 dias, matemática atual e FAQ confirmados.
- `/affiliate`: HTTP 200 no domínio público.
- Claims antigos confirmados como ausentes em produção.
- Sitemap: 66 URLs, 66 únicas, `/partners` presente.

## Gate de resultado

Este PUSH só cria um canal orgânico confiável; não conta como conversão. O placar muda apenas com assinatura Stripe externa real em estado `active` ou `trialing`. O PUSH #32 continua acumulando dados por 24–48 horas antes de qualquer troca de copy.
